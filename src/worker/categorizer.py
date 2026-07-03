"""Predicts categories for a user's still-uncategorized transactions.

Trains a multi-label text classifier (TF-IDF over the transaction label,
feeding a one-vs-rest logistic regression - one binary classifier per
category) from that user's own already-categorized transactions, then
predicts categories for every transaction they haven't categorized yet.
Genuinely multi-label, not "pick one": a transaction can carry several
categories at once (e.g. "Transport" and "Pro" on the same expense), so
training has to see each transaction's *full* set of tags together - treating
multi-tagged transactions as several single-label examples would map the same
label text to multiple conflicting "right answers" and teach the model
nothing useful from them.

Retrained from scratch on every sync run rather than persisted - the dataset
is at most a few thousand rows for a single user, so fitting it again each
time is cheap and avoids dealing with stale models or versioning.
"""

from dataclasses import dataclass, field

import asyncpg
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.multiclass import OneVsRestClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import MultiLabelBinarizer

# Predictions at or above this confidence are inserted into
# transaction_categories automatically instead of waiting for the user to
# accept them - see src/frontend/lib/actions.ts acceptPredictedCategory for
# the manual-accept path.
AUTO_APPROVE_THRESHOLD = 0.9

# Below this, the model doesn't have a real signal to go on - e.g. generic
# virement labels on income-side categories ("Prime" vs "Bourse" vs "Don")
# routinely score 0.12-0.20 in testing, well below what even an even split
# across a handful of categories would give by chance. Surfacing those as
# suggestions would just be noise the user has to dismiss every time, so
# below this floor nothing is stored for that category at all.
MIN_SUGGEST_THRESHOLD = 0.3

# Below either of these, there isn't enough signal to fit a meaningful
# classifier yet (e.g. a brand new user with a handful of categorized
# transactions) - skip rather than emit noisy, overconfident predictions.
MIN_TRAINING_EXAMPLES = 10
MIN_DISTINCT_CATEGORIES = 2


@dataclass
class _TrainingRow:
    label: str
    category_ids: list[int] = field(default_factory=list)


@dataclass
class _TargetRow:
    row_id: int
    label: str


async def categorize_transactions(conn: asyncpg.Connection, user_id: int) -> None:
    """
    Predict and store categories for this user's uncategorized transactions.

    Training data and prediction targets are both scoped to categories
    *owned by this user* (``categories.user_id = $1``), not just any category
    visible on a shared transaction - a joint account can have co-owners with
    entirely separate category trees, and a category one owner already
    assigned shouldn't be mistaken for "this transaction is categorized" from
    another owner's point of view, nor should their category ids leak into
    this user's model.

    :param conn: Open PostgreSQL connection (expected to be inside the same
        transaction the rest of the sync run uses)
    :type conn: asyncpg.Connection
    :param user_id: id of the owning row in ``users``
    :type user_id: int
    :return: None
    :rtype: None
    """
    training_by_transaction: dict[int, _TrainingRow] = {}
    for row in await conn.fetch(
        """
        SELECT t.row_id, t.label, tc.category_id
        FROM transactions t
        JOIN accounts a ON a.internal_id = t.account_internal_id
        JOIN account_users au ON au.account_internal_id = a.internal_id AND au.user_id = $1
        JOIN transaction_categories tc ON tc.transaction_row_id = t.row_id
        JOIN categories c ON c.id = tc.category_id AND c.user_id = $1
        """,
        user_id,
    ):
        training_row = training_by_transaction.setdefault(
            row["row_id"], _TrainingRow(label=row["label"])
        )
        training_row.category_ids.append(row["category_id"])

    training_rows = list(training_by_transaction.values())
    distinct_categories = {
        category_id for row in training_rows for category_id in row.category_ids
    }
    if (
        len(training_rows) < MIN_TRAINING_EXAMPLES
        or len(distinct_categories) < MIN_DISTINCT_CATEGORIES
    ):
        return

    target_rows = [
        _TargetRow(row_id=row["row_id"], label=row["label"])
        for row in await conn.fetch(
            """
            SELECT t.row_id, t.label
            FROM transactions t
            JOIN accounts a ON a.internal_id = t.account_internal_id
            JOIN account_users au ON au.account_internal_id = a.internal_id AND au.user_id = $1
            WHERE NOT EXISTS (
                SELECT 1 FROM transaction_categories tc
                JOIN categories c ON c.id = tc.category_id AND c.user_id = $1
                WHERE tc.transaction_row_id = t.row_id
            )
            """,
            user_id,
        )
    ]
    if not target_rows:
        return

    binarizer = MultiLabelBinarizer()
    label_matrix = binarizer.fit_transform([row.category_ids for row in training_rows])

    model = Pipeline(
        [
            ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=1)),
            ("classifier", OneVsRestClassifier(LogisticRegression(max_iter=1000))),
        ]
    )
    model.fit([row.label for row in training_rows], label_matrix)

    # One column per category, each holding that category's own independent
    # probability (not a softmax over categories) - a transaction can score
    # high on more than one at once, which is the whole point.
    probabilities = model.predict_proba([row.label for row in target_rows])
    category_ids = [int(category_id) for category_id in binarizer.classes_]

    target_row_ids = [row.row_id for row in target_rows]
    # Clear out any stale suggestions for these transactions before writing
    # this run's - e.g. a category that scored 0.4 last run and no longer
    # clears MIN_SUGGEST_THRESHOLD this run shouldn't linger as a suggestion.
    await conn.execute(
        "DELETE FROM transaction_category_predictions WHERE transaction_row_id = ANY($1::bigint[])",
        target_row_ids,
    )

    for target_row, row_probabilities in zip(target_rows, probabilities, strict=True):
        for category_id, confidence in zip(
            category_ids, row_probabilities, strict=True
        ):
            confidence = float(confidence)
            if confidence < MIN_SUGGEST_THRESHOLD:
                continue

            if confidence >= AUTO_APPROVE_THRESHOLD:
                await conn.execute(
                    """
                    INSERT INTO transaction_categories (transaction_row_id, category_id)
                    VALUES ($1, $2)
                    ON CONFLICT DO NOTHING
                    """,
                    target_row.row_id,
                    category_id,
                )
            else:
                await conn.execute(
                    """
                    INSERT INTO transaction_category_predictions (transaction_row_id, category_id, confidence)
                    VALUES ($1, $2, $3)
                    """,
                    target_row.row_id,
                    category_id,
                    confidence,
                )
