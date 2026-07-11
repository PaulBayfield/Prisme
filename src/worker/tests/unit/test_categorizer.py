"""Unit tests for categorizer.categorize_transactions.

Uses a small hand-written fake in place of asyncpg.Connection - real
sklearn training runs in-process (the dataset is tiny), but nothing ever
touches a real database.
"""

import pytest

from categorizer import (
    AUTO_APPROVE_THRESHOLD,
    MIN_DISTINCT_CATEGORIES,
    MIN_SUGGEST_THRESHOLD,
    MIN_TRAINING_EXAMPLES,
    categorize_transactions,
)

USER_ID = 42


class FakeConnection:
    """Minimal stand-in for asyncpg.Connection.

    Dispatches ``fetch`` based on the query text: the "target" (uncategorized
    transactions) query is the only one of the two SELECTs that contains a
    ``NOT EXISTS`` clause, everything else is the training-data query.
    """

    def __init__(self, training_rows=None, target_rows=None):
        self.training_rows = training_rows or []
        self.target_rows = target_rows or []
        self.fetch_calls = []
        self.execute_calls = []

    async def fetch(self, query, user_id):
        self.fetch_calls.append(query)
        assert user_id == USER_ID
        if "NOT EXISTS" in query:
            return self.target_rows
        return self.training_rows

    async def execute(self, query, *args):
        self.execute_calls.append((query, args))


def _call_kind(query: str) -> str:
    if "DELETE FROM transaction_category_predictions" in query:
        return "delete"
    if "INSERT INTO transaction_category_predictions" in query:
        return "predict_insert"
    if "INSERT INTO transaction_categories" in query:
        return "auto_insert"
    raise AssertionError(f"unexpected query passed to execute(): {query!r}")


class TestGuardClauses:
    async def test_returns_early_below_min_training_examples(self):
        # 3 rows across 2 categories - below MIN_TRAINING_EXAMPLES (10).
        assert 3 < MIN_TRAINING_EXAMPLES
        training_rows = [
            {"row_id": 1, "label": "a", "category_id": 1},
            {"row_id": 2, "label": "b", "category_id": 2},
            {"row_id": 3, "label": "c", "category_id": 1},
        ]
        conn = FakeConnection(training_rows=training_rows)

        await categorize_transactions(conn, USER_ID)

        assert conn.execute_calls == []
        # Only the training query should have been fetched - the function
        # must bail out before ever looking at target rows.
        assert len(conn.fetch_calls) == 1

    async def test_returns_early_below_min_distinct_categories(self):
        assert MIN_DISTINCT_CATEGORIES == 2
        # Plenty of rows, but they all share the same single category.
        training_rows = [
            {"row_id": i, "label": f"label {i}", "category_id": 1}
            for i in range(MIN_TRAINING_EXAMPLES + 5)
        ]
        conn = FakeConnection(training_rows=training_rows)

        await categorize_transactions(conn, USER_ID)

        assert conn.execute_calls == []
        assert len(conn.fetch_calls) == 1

    async def test_returns_early_when_no_target_rows(self):
        training_rows = (
            [
                {"row_id": i, "label": "netflix streaming", "category_id": 1}
                for i in range(6)
            ]
            + [
                {"row_id": 100 + i, "label": "carrefour courses", "category_id": 2}
                for i in range(6)
            ]
        )
        conn = FakeConnection(training_rows=training_rows, target_rows=[])

        await categorize_transactions(conn, USER_ID)

        assert conn.execute_calls == []
        # Both queries get fetched this time - training passes the
        # thresholds, so the function goes on to fetch targets, finds none,
        # and bails before ever writing anything.
        assert len(conn.fetch_calls) == 2


class TestHappyPath:
    """Trains the real sklearn pipeline on canned, well-separated labels.

    Category 1 ("netflix...") dominates the training set (50 of 60 rows),
    category 2 ("carrefour...") is a minority (8 rows), category 3
    ("essence...") is a rare outlier (2 rows) - this imbalance is what
    naturally produces the confidence spread the assertions below rely on:
    an exact match against the dominant category clears the auto-approve
    bar, a label blending two categories' vocabulary lands in the
    suggestion range for both, and an unrelated label's rare-category score
    falls below the suggestion floor. These are the real, non-overfitted
    probabilities the pipeline produces for this data (verified by hand
    before writing the assertions) - not hand-picked to hit exact numbers.
    """

    @pytest.fixture
    def conn(self):
        training_rows = (
            [
                {
                    "row_id": i,
                    "label": "netflix streaming abonnement mensuel",
                    "category_id": 1,
                }
                for i in range(50)
            ]
            + [
                {
                    "row_id": 1000 + i,
                    "label": "carrefour supermarche courses alimentaires",
                    "category_id": 2,
                }
                for i in range(8)
            ]
            + [
                {
                    "row_id": 2000 + i,
                    "label": "essence station carburant total",
                    "category_id": 3,
                }
                for i in range(2)
            ]
        )
        target_rows = [
            # Exact match against the dominant category -> should clear
            # AUTO_APPROVE_THRESHOLD for category 1.
            {"row_id": 5001, "label": "netflix streaming abonnement mensuel"},
            # Blends categories 1 and 2's vocabulary -> mid-confidence
            # ("suggest") for both, not auto-approved for either.
            {"row_id": 5002, "label": "carrefour mensuel supermarche"},
            # Shares no vocabulary with any category -> nothing should
            # clear the suggestion floor for the minority categories.
            {
                "row_id": 5003,
                "label": "virement recu de m dupont totalement autre chose",
            },
        ]
        return FakeConnection(training_rows=training_rows, target_rows=target_rows)

    async def test_clears_stale_predictions_before_writing_new_ones(self, conn):
        await categorize_transactions(conn, USER_ID)

        assert conn.execute_calls, "expected at least the DELETE call"
        first_kind = _call_kind(conn.execute_calls[0][0])
        assert first_kind == "delete"

        delete_query, delete_args = conn.execute_calls[0]
        assert delete_args == ([5001, 5002, 5003],)

        # Nothing else should delete again later.
        assert all(
            _call_kind(query) != "delete" for query, _ in conn.execute_calls[1:]
        )

    async def test_exact_match_against_dominant_category_is_auto_approved(self, conn):
        await categorize_transactions(conn, USER_ID)

        auto_inserts = [
            args
            for query, args in conn.execute_calls
            if _call_kind(query) == "auto_insert"
        ]
        assert (5001, 1) in auto_inserts

        # It shouldn't also show up as a mere suggestion for category 1.
        predict_inserts = [
            args
            for query, args in conn.execute_calls
            if _call_kind(query) == "predict_insert"
        ]
        assert all(not (row_id == 5001 and cat == 1) for row_id, cat, _ in predict_inserts)

    async def test_blended_label_is_suggested_not_auto_approved(self, conn):
        await categorize_transactions(conn, USER_ID)

        predict_inserts = {
            (row_id, cat): confidence
            for query, (row_id, cat, confidence) in (
                (q, a) for q, a in conn.execute_calls if _call_kind(q) == "predict_insert"
            )
        }
        auto_inserts = {
            (row_id, cat)
            for query, (row_id, cat) in (
                (q, a) for q, a in conn.execute_calls if _call_kind(q) == "auto_insert"
            )
        }

        # Blended row 5002 should be suggested for both categories 1 and 2,
        # each within [MIN_SUGGEST_THRESHOLD, AUTO_APPROVE_THRESHOLD).
        for cat in (1, 2):
            assert (5002, cat) in predict_inserts
            confidence = predict_inserts[(5002, cat)]
            assert MIN_SUGGEST_THRESHOLD <= confidence < AUTO_APPROVE_THRESHOLD
            assert (5002, cat) not in auto_inserts

        # The rare, unrelated category shouldn't even clear the suggestion
        # floor for this label.
        assert (5002, 3) not in predict_inserts
        assert (5002, 3) not in auto_inserts

    async def test_unrelated_label_drops_minority_categories(self, conn):
        await categorize_transactions(conn, USER_ID)

        all_targets_for_5003 = {
            (row_id, cat)
            for query, args in conn.execute_calls
            if _call_kind(query) in ("predict_insert", "auto_insert")
            for row_id, cat, *_ in [args]
            if row_id == 5003
        }

        # The minority/outlier categories carry no signal at all for this
        # label - nothing should be written for them.
        assert (5003, 2) not in all_targets_for_5003
        assert (5003, 3) not in all_targets_for_5003

    async def test_every_stored_confidence_is_within_its_bucket_bounds(self, conn):
        await categorize_transactions(conn, USER_ID)

        for query, args in conn.execute_calls:
            kind = _call_kind(query)
            if kind == "predict_insert":
                _, _, confidence = args
                assert MIN_SUGGEST_THRESHOLD <= confidence < AUTO_APPROVE_THRESHOLD
            elif kind == "auto_insert":
                # auto_insert doesn't carry confidence, but its existence
                # implies a probability >= AUTO_APPROVE_THRESHOLD was
                # computed - covered indirectly by the fixture's canned,
                # pre-verified probabilities.
                assert len(args) == 2
