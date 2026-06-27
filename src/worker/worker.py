"""Class that syncs LCL account/transaction data into PostgreSQL, for one user's credentials."""

import json
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

import asyncpg

from categorizer import categorize_transactions
from income_forecast import MODEL_NAME, build_monthly_series, compute_expected_income
from lib.LCLPy import LCLClient
from lib.LCLPy.objects import Account, Transaction
from utils import parse_dt, to_decimal


@dataclass
class Credentials:
    """
    One user's decrypted LCL credentials, as read from ``lcl_credentials``.

    :param user_id: id of the owning row in ``users``
    :type user_id: int
    :param identifier: LCL login identifier
    :type identifier: str
    :param keypad: LCL login keypad
    :type keypad: str
    :param session_id: LCL session id
    :type session_id: str
    :param contract_id: LCL contract id
    :type contract_id: str
    """

    user_id: int
    identifier: str
    keypad: str
    session_id: str
    contract_id: str


async def fetch_credentials(pool: asyncpg.Pool, encryption_key: str) -> list[Credentials]:
    """
    Read and decrypt every stored set of LCL credentials.

    :param pool: PostgreSQL connection pool
    :type pool: asyncpg.Pool
    :param encryption_key: pgcrypto passphrase used to decrypt the stored credentials
    :type encryption_key: str
    :return: One :class:`Credentials` per row in ``lcl_credentials``
    :rtype: list[Credentials]
    """
    rows = await pool.fetch(
        """
        SELECT
            user_id,
            pgp_sym_decrypt(identifier, $1) AS identifier,
            pgp_sym_decrypt(keypad, $1) AS keypad,
            pgp_sym_decrypt(session_id, $1) AS session_id,
            pgp_sym_decrypt(contract_id, $1) AS contract_id
        FROM lcl_credentials
        """,
        encryption_key,
    )

    return [
        Credentials(
            user_id=row["user_id"],
            identifier=row["identifier"],
            keypad=row["keypad"],
            session_id=row["session_id"],
            contract_id=row["contract_id"],
        )
        for row in rows
    ]


async def fetch_credentials_for_user(pool: asyncpg.Pool, encryption_key: str, user_id: int) -> Credentials | None:
    """
    Read and decrypt one user's stored LCL credentials, if any.

    ``lcl_credentials.user_id`` is UNIQUE (one row per user - their current
    LCL session, see schema.sql), so this is the single-user counterpart to
    :func:`fetch_credentials` used by the sync queue, which processes one
    user per request rather than the whole table at once.

    :param pool: PostgreSQL connection pool
    :type pool: asyncpg.Pool
    :param encryption_key: pgcrypto passphrase used to decrypt the stored credentials
    :type encryption_key: str
    :param user_id: id of the owning row in ``users``
    :type user_id: int
    :return: This user's :class:`Credentials`, or ``None`` if they have none stored
    :rtype: Credentials | None
    """
    row = await pool.fetchrow(
        """
        SELECT
            user_id,
            pgp_sym_decrypt(identifier, $1) AS identifier,
            pgp_sym_decrypt(keypad, $1) AS keypad,
            pgp_sym_decrypt(session_id, $1) AS session_id,
            pgp_sym_decrypt(contract_id, $1) AS contract_id
        FROM lcl_credentials
        WHERE user_id = $2
        """,
        encryption_key,
        user_id,
    )
    if row is None:
        return None

    return Credentials(
        user_id=row["user_id"],
        identifier=row["identifier"],
        keypad=row["keypad"],
        session_id=row["session_id"],
        contract_id=row["contract_id"],
    )


class Worker:
    """
    Fetches LCL account and transaction data for one user and persists it to PostgreSQL.

    :param user_id: id of the owning row in ``users``
    :type user_id: int
    :param identifier: LCL login identifier
    :type identifier: str
    :param keypad: LCL login keypad
    :type keypad: str
    :param session_id: LCL session id
    :type session_id: str
    :param contract_id: LCL contract id
    :type contract_id: str
    """

    def __init__(self, user_id: int, identifier: str, keypad: str, session_id: str, contract_id: str) -> None:
        self.user_id = user_id
        self.client = LCLClient(
            identifier=identifier,
            keypad=keypad,
            session_id=session_id,
            contract_id=contract_id,
        )


    async def run(self, pool: asyncpg.Pool) -> None:
        """
        Fetch every current and savings account, their balances, and their
        transactions for this user, then persist all of it to PostgreSQL in
        a single transaction. Also forecasts this month's income and
        predicts categories for any still-uncategorized transactions (see
        :func:`categorizer.categorize_transactions`).

        :param pool: PostgreSQL connection pool
        :type pool: asyncpg.Pool
        :return: None
        :rtype: None
        """
        await self.client.login()

        accounts = await self.client.getAccounts("current")
        savings_accounts = await self.client.getSavingsAccounts()

        async with pool.acquire() as conn, conn.transaction():
            for account in [*accounts, *savings_accounts]:
                await self._upsert_account(conn, account)
                await self._insert_balance(conn, account)

                transactions = await account.getTransactions()
                pending, processed = [], []
                for transaction in transactions:
                    # nature "I" means LCL is still processing the transaction (in progress);
                    # such transactions also lack a stable id, but checking both is the safe bet.
                    is_pending = transaction.id is None or transaction.nature == "I"
                    (pending if is_pending else processed).append(transaction)

                for transaction in processed:
                    await self._upsert_transaction(conn, account.internal_id, transaction)

                await self._replace_pending_transactions(conn, account.internal_id, pending)

            await self._forecast_income(conn)
            await categorize_transactions(conn, self.user_id)


    async def _forecast_income(self, conn: asyncpg.Connection) -> None:
        """
        Predict this user's salary for the current calendar month and store
        it, so the frontend can compare actual income-to-date against it.

        Fits a trend over this user's completed months of salary (positive
        transactions on their current accounts tagged with a category named
        "Salaire") and extrapolates one month forward. Scoped to that one
        category rather than every positive transaction, since gifts,
        interest, internal transfers, and other one-off income would
        otherwise add noise unrelated to the user's actual paycheck. Does
        nothing if there isn't at least one completed month of salary
        history yet.

        :param conn: Open PostgreSQL connection
        :type conn: asyncpg.Connection
        :return: None
        :rtype: None
        """
        current_month = date.today().replace(day=1)

        rows = await conn.fetch(
            """
            SELECT date_trunc('month', t.booking_date_time)::date AS month, SUM(t.amount) AS total
            FROM transactions t
            JOIN accounts a ON a.internal_id = t.account_internal_id
            JOIN account_users au ON au.account_internal_id = a.internal_id
            WHERE au.user_id = $1 AND t.amount > 0
              AND t.booking_date_time < date_trunc('month', now())
              AND a.type = 'current'
              AND EXISTS (
                SELECT 1 FROM transaction_categories tc
                JOIN categories c ON c.id = tc.category_id
                WHERE tc.transaction_row_id = t.row_id AND LOWER(c.name) = 'salaire'
              )
            GROUP BY month
            ORDER BY month
            """,
            self.user_id,
        )
        if not rows:
            return

        totals_by_month = {row["month"]: Decimal(row["total"]) for row in rows}
        if current_month.month > 1:
            last_completed_month = current_month.replace(month=current_month.month - 1)
        else:
            last_completed_month = current_month.replace(year=current_month.year - 1, month=12)
        series = build_monthly_series(totals_by_month, min(totals_by_month), last_completed_month)

        predicted = compute_expected_income(series)
        if predicted is None:
            return

        await conn.execute(
            """
            INSERT INTO income_predictions (user_id, period_month, predicted_amount, model, updated_at)
            VALUES ($1, $2, $3, $4, now())
            ON CONFLICT (user_id, period_month) DO UPDATE SET
                predicted_amount = EXCLUDED.predicted_amount,
                model = EXCLUDED.model,
                updated_at = now()
            """,
            self.user_id,
            current_month,
            predicted,
            MODEL_NAME,
        )


    async def _upsert_account(self, conn: asyncpg.Connection, account: Account) -> None:
        """
        Insert an account's metadata, or update it if it already exists,
        then link it to this worker's user.

        accounts.internal_id is shared by every Prisme user who can see that
        account (LCL reports the same id for a joint/shared account no
        matter whose credentials ask), so it's upserted once here with no
        owner, and the (account, user) relationship - including the
        per-viewer holder_label/user_role - is upserted separately into
        account_users. Doing it as one upsert keyed only on internal_id
        would let the last user to sync silently "steal" a shared account
        from everyone else.

        :param conn: Open PostgreSQL connection
        :type conn: asyncpg.Connection
        :param account: Account to persist
        :type account: lib.LCLPy.objects.Account
        :return: None
        :rtype: None
        """
        await conn.execute(
            """
            INSERT INTO accounts (
                internal_id, external_id, account_number, iban, label, short_label,
                type, bank_code, agency_code,
                account_creation_date, product_code, product_type, aggregation, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, now())
            ON CONFLICT (internal_id) DO UPDATE SET
                external_id = EXCLUDED.external_id,
                account_number = EXCLUDED.account_number,
                iban = EXCLUDED.iban,
                label = EXCLUDED.label,
                short_label = EXCLUDED.short_label,
                type = EXCLUDED.type,
                bank_code = EXCLUDED.bank_code,
                agency_code = EXCLUDED.agency_code,
                account_creation_date = EXCLUDED.account_creation_date,
                product_code = EXCLUDED.product_code,
                product_type = EXCLUDED.product_type,
                aggregation = EXCLUDED.aggregation,
                updated_at = now()
            """,
            account.internal_id,
            account.external_id,
            account.account_number,
            account.iban,
            account.label,
            account.short_label,
            account.type,
            account.bank_code,
            account.agency_code,
            parse_dt(account.account_creation_date),
            account.product_code,
            account.product_type,
            json.dumps(account.aggregation) if account.aggregation is not None else None,
        )

        await conn.execute(
            """
            INSERT INTO account_users (account_internal_id, user_id, user_role, holder_label, updated_at)
            VALUES ($1, $2, $3, $4, now())
            ON CONFLICT (account_internal_id, user_id) DO UPDATE SET
                user_role = EXCLUDED.user_role,
                holder_label = EXCLUDED.holder_label,
                updated_at = now()
            """,
            account.internal_id,
            self.user_id,
            account.user_role,
            account.holder_label,
        )


    async def _insert_balance(self, conn: asyncpg.Connection, account: Account) -> None:
        """
        Insert a new balance snapshot for an account.

        :param conn: Open PostgreSQL connection
        :type conn: asyncpg.Connection
        :param account: Account whose balance is being recorded
        :type account: lib.LCLPy.objects.Account
        :return: None
        :rtype: None
        """
        await conn.execute(
            """
            INSERT INTO account_balances (
                account_internal_id, amount, amount_currency, amount_date,
                accounted_amount, accounted_amount_currency, accounted_amount_date
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            """,
            account.internal_id,
            to_decimal(account.amount),
            account.amount_currency,
            parse_dt(account.amount_date),
            to_decimal(account.accounted_amount),
            account.accounted_amount_currency,
            parse_dt(account.accounted_amount_date),
        )


    async def _upsert_transaction(self, conn: asyncpg.Connection, account_internal_id: str, transaction: Transaction) -> None:
        """
        Insert a transaction, or update it if it already exists.

        LCL's own ``id`` field isn't a stable identifier for a transaction -
        it behaves like a position within the response and can change for
        the same real transaction between syncs - so it's deliberately left
        out of the conflict target (see pk_transactions in schema.sql).

        :param conn: Open PostgreSQL connection
        :type conn: asyncpg.Connection
        :param account_internal_id: internal_id of the account the transaction belongs to
        :type account_internal_id: str
        :param transaction: Transaction to persist
        :type transaction: lib.LCLPy.objects.Transaction
        :return: None
        :rtype: None
        """
        await conn.execute(
            """
            INSERT INTO transactions (
                id, account_internal_id, label, detail_labels, booking_date_time,
                value_date_time, is_accounted, are_details_available, amount,
                amount_currency, movement_code_type, nature, updated_at
            )
            VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, now())
            ON CONFLICT (account_internal_id, label, amount, booking_date_paris) DO UPDATE SET
                id = EXCLUDED.id,
                detail_labels = EXCLUDED.detail_labels,
                booking_date_time = EXCLUDED.booking_date_time,
                value_date_time = EXCLUDED.value_date_time,
                is_accounted = EXCLUDED.is_accounted,
                are_details_available = EXCLUDED.are_details_available,
                amount_currency = EXCLUDED.amount_currency,
                movement_code_type = EXCLUDED.movement_code_type,
                nature = EXCLUDED.nature,
                updated_at = now()
            """,
            transaction.id,
            account_internal_id,
            transaction.label,
            json.dumps(transaction.detail_labels) if transaction.detail_labels is not None else None,
            parse_dt(transaction.booking_date_time),
            parse_dt(transaction.value_date_time),
            transaction.is_accounted,
            transaction.are_details_available,
            to_decimal(transaction.amount),
            transaction.amount_currency,
            transaction.movement_code_type,
            transaction.nature,
        )


    async def _replace_pending_transactions(self, conn: asyncpg.Connection, account_internal_id: str, transactions: list[Transaction]) -> None:
        """
        Replace the stored pending-transactions snapshot for an account.

        Transactions LCL hasn't processed yet have no stable id, so they
        can't be upserted like accounted ones; this clears the previous
        snapshot for the account and reinserts the current pending list, so
        the table always reflects the latest run.

        :param conn: Open PostgreSQL connection
        :type conn: asyncpg.Connection
        :param account_internal_id: internal_id of the account the transactions belong to
        :type account_internal_id: str
        :param transactions: Currently pending transactions for this account (no id yet)
        :type transactions: list[lib.LCLPy.objects.Transaction]
        :return: None
        :rtype: None
        """
        await conn.execute(
            "DELETE FROM pending_transactions WHERE account_internal_id = $1",
            account_internal_id,
        )

        for transaction in transactions:
            await conn.execute(
                """
                INSERT INTO pending_transactions (
                    account_internal_id, label, detail_labels, booking_date_time,
                    value_date_time, is_accounted, are_details_available, amount,
                    amount_currency, movement_code_type, nature
                )
                VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11)
                """,
                account_internal_id,
                transaction.label,
                json.dumps(transaction.detail_labels) if transaction.detail_labels is not None else None,
                parse_dt(transaction.booking_date_time),
                parse_dt(transaction.value_date_time),
                transaction.is_accounted,
                transaction.are_details_available,
                to_decimal(transaction.amount),
                transaction.amount_currency,
                transaction.movement_code_type,
                transaction.nature,
            )
