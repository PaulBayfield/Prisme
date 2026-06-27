/***************************************************************
    *  Prisme - schema.sql
    *  Created by: Paul BAYFIELD
    *  Created on: 19/06/2026
    *  Updated on: 20/06/2026
    *  Description: SQL database scheme for the Prisme project
***************************************************************/


CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id           BIGSERIAL PRIMARY KEY,
    email        TEXT NOT NULL UNIQUE,
    -- NULL until the user finishes (or skips) the onboarding wizard - the
    -- frontend redirects here until this is set. Set once, never cleared.
    onboarded_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- identifier/keypad/session_id/contract_id are encrypted with pgp_sym_encrypt.
-- One row per user (UNIQUE) - this is "their current LCL session", not a
-- history, so reconnecting (Settings -> Compte or onboarding) upserts in
-- place rather than accumulating stale rows the worker would otherwise also
-- try to sync.
CREATE TABLE lcl_credentials (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    identifier  BYTEA NOT NULL,
    keypad      BYTEA NOT NULL,
    session_id  BYTEA NOT NULL,
    contract_id BYTEA NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lcl_credentials_user ON lcl_credentials (user_id);

-- User-defined transaction categories with an optional parent for a simple
-- hierarchy (e.g. "Transport" -> "Car"). Colour normally lives on the root
-- category; a child with a NULL color inherits its nearest ancestor's
-- (resolved by the app, not enforced here). Created/edited from the
-- frontend only - the worker never writes this table, but does read it
-- (see worker/income_forecast.py), via category_use_cases below, to know
-- which categories count as salary for the income forecast.
CREATE TABLE categories (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    parent_id  BIGINT REFERENCES categories (id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    color      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_user ON categories (user_id);
CREATE INDEX idx_categories_parent ON categories (parent_id);

-- A plain UNIQUE(user_id, parent_id, name) wouldn't catch duplicate root
-- names: Postgres never treats two NULLs as equal, so every root category
-- has a distinct (effectively wildcard) parent_id and the constraint never
-- fires for them. Two partial indexes instead, one per case.
CREATE UNIQUE INDEX idx_categories_unique_root_name
    ON categories (user_id, name) WHERE parent_id IS NULL;
CREATE UNIQUE INDEX idx_categories_unique_child_name
    ON categories (user_id, parent_id, name) WHERE parent_id IS NOT NULL;

-- Lets each user pick which of their own categories feed a given built-in
-- feature (income forecast, income exclusions, savings tracking), instead
-- of the app guessing by category name. use_case is a fixed set of string
-- literals the app defines (not user-editable) - see CategoryUseCase in
-- src/frontend/lib/types.ts. A list, not a single category: a use case can
-- be satisfied by several categories (e.g. salary paid from two sources).
CREATE TABLE category_use_cases (
    user_id     BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    use_case    TEXT NOT NULL,
    category_id BIGINT NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (user_id, use_case, category_id)
);

CREATE INDEX idx_category_use_cases_user_use_case ON category_use_cases (user_id, use_case);

-- Short-lived, single-use passphrase the app hands to the extension so it
-- can AES-encrypt the captured login payload for the user to copy/paste back
-- into the app. Unrelated to the pgcrypto passphrase
-- above: this one is per-request, expires after 15 minutes, and the worker
-- never reads this table.
CREATE TABLE credential_exchange_requests (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    passphrase TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credential_exchange_requests_user ON credential_exchange_requests (user_id);

-- The worker and frontend are separate processes with nothing in common but
-- Postgres, so this table is the queue/status board between them: the
-- frontend enqueues a 'pending' row (on demand from the header's refresh
-- button, or right after a user connects/reconnects LCL), and separately
-- the worker enqueues one for every connected user every 30 minutes. The
-- worker's polling loop drains 'pending' rows, marks each 'running' then
-- 'success'/'error' (with `error` set), one user's failure never blocking
-- another's. The frontend reads the latest row per user to show sync status.
CREATE TABLE sync_requests (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    status       TEXT NOT NULL DEFAULT 'pending', -- pending | running | success | error
    error        TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at   TIMESTAMPTZ,
    finished_at  TIMESTAMPTZ
);

CREATE INDEX idx_sync_requests_user ON sync_requests (user_id, requested_at DESC);
CREATE INDEX idx_sync_requests_pending ON sync_requests (status) WHERE status = 'pending';

-- One row per real bank account, not per (account, user) - LCL reports the
-- same internal_id for a joint/shared account no matter whose credentials
-- ask, so account_users below (not a user_id column here) is what links it
-- to whichever Prisme users can see it. Everything on this table describes
-- the account itself and is the same regardless of viewer.
CREATE TABLE accounts (
    internal_id           TEXT PRIMARY KEY,
    external_id           TEXT,
    account_number        TEXT,
    iban                  TEXT,
    label                 TEXT,
    short_label           TEXT,
    type                  TEXT,
    bank_code             TEXT,
    agency_code           TEXT,
    account_creation_date TIMESTAMPTZ,
    product_code          TEXT,
    product_type          TEXT,
    aggregation           JSONB,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- holder_label/user_role come from LCL's response too, but describe the
-- relationship between one user's credentials and the account (e.g.
-- "holder" vs "other"), which can differ per viewer even for the same
-- account - hence tracked per (account, user) rather than on accounts.
CREATE TABLE account_users (
    account_internal_id TEXT NOT NULL REFERENCES accounts (internal_id) ON DELETE CASCADE,
    user_id             BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    user_role           TEXT,
    holder_label        TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (account_internal_id, user_id)
);

CREATE INDEX idx_account_users_user ON account_users (user_id);

-- One row per balance snapshot, so balance history can be charted over time.
CREATE TABLE account_balances (
    id                        BIGSERIAL PRIMARY KEY,
    account_internal_id       TEXT NOT NULL REFERENCES accounts (internal_id) ON DELETE CASCADE,
    amount                    NUMERIC(14, 2) NOT NULL,
    amount_currency           TEXT NOT NULL,
    amount_date               TIMESTAMPTZ NOT NULL,
    accounted_amount          NUMERIC(14, 2),
    accounted_amount_currency TEXT,
    accounted_amount_date     TIMESTAMPTZ,
    captured_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Composite, not just (account_internal_id): every query against this table
-- (latest balance via LATERAL/DISTINCT ON, history charts) filters by
-- account and orders by captured_at together, so the single-column index
-- alone would still need a separate sort step.
CREATE INDEX idx_account_balances_account_captured ON account_balances (account_internal_id, captured_at DESC);

CREATE TABLE transactions (
    -- row_id is a stable surrogate the frontend can target (e.g. to assign a
    -- category) - id alone isn't unique enough for that, see pk_transactions.
    row_id                BIGSERIAL NOT NULL UNIQUE,
    -- LCL's own transaction id - kept for reference/display only. It is NOT
    -- a stable identifier: it behaves like a position within the API
    -- response and can come back different for the same real transaction
    -- between syncs, so it's excluded from pk_transactions below.
    id                    TEXT NOT NULL,
    account_internal_id   TEXT NOT NULL REFERENCES accounts (internal_id) ON DELETE CASCADE,
    label                 TEXT NOT NULL,
    detail_labels         JSONB,
    booking_date_time     TIMESTAMPTZ NOT NULL,
    -- booking_date_time for a processed transaction is really just "which
    -- day", dressed as a timestamp - but the instant varies depending on
    -- the source (LCL reports true Paris midnight; the legacy import
    -- (script/import_legacy_transactions.py) wrote a bare UTC midnight, 2
    -- hours later in summer). Bucketing by the Paris calendar day makes
    -- both representations resolve to the same key.
    booking_date_paris    DATE GENERATED ALWAYS AS ((booking_date_time AT TIME ZONE 'Europe/Paris')::date) STORED,
    value_date_time       TIMESTAMPTZ,
    is_accounted          BOOLEAN,
    are_details_available BOOLEAN,
    amount                NUMERIC(14, 2) NOT NULL,
    amount_currency       TEXT,
    movement_code_type    TEXT,
    nature                TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT pk_transactions PRIMARY KEY (account_internal_id, label, amount, booking_date_paris)
);

-- Composite, not just (account_internal_id): the frontend always filters by
-- account (or a small set of a user's accounts) together with a
-- booking_date_time range/ordering - this serves both in one index scan.
CREATE INDEX idx_transactions_account_booking ON transactions (account_internal_id, booking_date_time DESC);

-- Label search (lib/data.ts's TransactionFilters.search) uses ILIKE
-- '%term%', which a plain btree index can't accelerate at all because of
-- the leading wildcard - pg_trgm's trigram index is what makes that fast.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_transactions_label_trgm ON transactions USING gin (label gin_trgm_ops);

-- A transaction can carry several categories (e.g. "Transport" and "Pro"),
-- hence a join table rather than a column on transactions.
CREATE TABLE transaction_categories (
    transaction_row_id BIGINT NOT NULL REFERENCES transactions (row_id) ON DELETE CASCADE,
    category_id        BIGINT NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (transaction_row_id, category_id)
);

CREATE INDEX idx_transaction_categories_category ON transaction_categories (category_id);

-- Worker-computed category suggestions (src/worker/categorizer.py) -
-- pending ones only. A transaction can take several tags at once (see
-- transaction_categories above), so this mirrors that shape one row per
-- (transaction, suggested category) rather than a single scalar column, and
-- the model is genuinely multi-label, not "pick one". Confidence
-- >= AUTO_APPROVE_THRESHOLD is inserted straight into transaction_categories
-- instead of landing here; rows here are consumed (deleted) the moment the
-- user accepts or rejects them, or get replaced wholesale on the next sync
-- run that re-predicts for that transaction - this table is never a
-- permanent record of "this was AI-suggested" the way transaction_categories
-- is for accepted ones.
CREATE TABLE transaction_category_predictions (
    transaction_row_id BIGINT NOT NULL REFERENCES transactions (row_id) ON DELETE CASCADE,
    category_id        BIGINT NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
    confidence          REAL NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (transaction_row_id, category_id)
);

-- Transactions LCL hasn't processed/accounted yet have no stable id, so they
-- can't live in `transactions`. This table is cleared per account and
-- refilled on every worker run, so it always reflects the latest pending
-- state instead of accumulating stale or duplicate snapshots. Once a
-- transaction is processed it gets a real id and moves to `transactions`.
CREATE TABLE pending_transactions (
    id                    BIGSERIAL PRIMARY KEY,
    account_internal_id   TEXT NOT NULL REFERENCES accounts (internal_id) ON DELETE CASCADE,
    label                 TEXT,
    detail_labels         JSONB,
    booking_date_time     TIMESTAMPTZ,
    value_date_time       TIMESTAMPTZ,
    is_accounted          BOOLEAN,
    are_details_available BOOLEAN,
    amount                NUMERIC(14, 2),
    amount_currency       TEXT,
    movement_code_type    TEXT,
    nature                TEXT,
    captured_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pending_transactions_account ON pending_transactions (account_internal_id);

-- Manually-tracked net worth assets (real estate, vehicles, etc.), outside
-- the LCL-synced accounts. Frontend-only, like categories - the worker
-- never reads or writes these tables. `type` is a fixed set of values
-- enforced by the app, not a DB constraint (same convention as
-- accounts.type / transactions.nature).
CREATE TABLE assets (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    type       TEXT NOT NULL,
    notes      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assets_user ON assets (user_id);

-- One row per value snapshot, so net worth can be charted over time -
-- mirrors account_balances.
CREATE TABLE asset_values (
    id             BIGSERIAL PRIMARY KEY,
    asset_id       BIGINT NOT NULL REFERENCES assets (id) ON DELETE CASCADE,
    value          NUMERIC(14, 2) NOT NULL,
    value_currency TEXT NOT NULL DEFAULT 'EUR',
    valued_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Composite, not just (asset_id) - same reasoning as
-- idx_account_balances_account_captured.
CREATE INDEX idx_asset_values_asset_valued ON asset_values (asset_id, valued_at DESC);

-- Manually-tracked debts (loans, mortgages, credit cards, etc.), the
-- liability counterpart to assets. Frontend-only, like assets - the worker
-- never reads or writes these tables. `type` is a fixed set of values
-- enforced by the app, not a DB constraint (same convention as assets.type).
CREATE TABLE debts (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    type       TEXT NOT NULL,
    notes      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_debts_user ON debts (user_id);

-- One row per balance snapshot, so debt payoff can be charted over time -
-- mirrors asset_values.
CREATE TABLE debt_values (
    id             BIGSERIAL PRIMARY KEY,
    debt_id        BIGINT NOT NULL REFERENCES debts (id) ON DELETE CASCADE,
    value          NUMERIC(14, 2) NOT NULL,
    value_currency TEXT NOT NULL DEFAULT 'EUR',
    valued_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Composite, not just (debt_id) - same reasoning as
-- idx_account_balances_account_captured.
CREATE INDEX idx_debt_values_debt_valued ON debt_values (debt_id, valued_at DESC);

-- Manually-tracked physical cash on hand - the off-books counterpart to the
-- LCL-synced accounts. There's only ever one cash figure per user (unlike
-- assets/debts, it isn't a named list), so this is scoped directly to
-- user_id with no parent entity table. One row per snapshot, so it can be
-- charted over time - mirrors asset_values/debt_values.
CREATE TABLE cash_values (
    id             BIGSERIAL PRIMARY KEY,
    user_id        BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    value          NUMERIC(14, 2) NOT NULL,
    value_currency TEXT NOT NULL DEFAULT 'EUR',
    valued_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Composite, not just (user_id) - same reasoning as
-- idx_account_balances_account_captured.
CREATE INDEX idx_cash_values_user_valued ON cash_values (user_id, valued_at DESC);

-- Manually-tracked Cheques-Vacances (ANCV holiday voucher) balance - same
-- shape and reasoning as cash_values: one liquid, off-books figure per user,
-- snapshotted over time rather than a named list like assets/debts.
CREATE TABLE vacation_voucher_values (
    id             BIGSERIAL PRIMARY KEY,
    user_id        BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    value          NUMERIC(14, 2) NOT NULL,
    value_currency TEXT NOT NULL DEFAULT 'EUR',
    valued_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Composite, not just (user_id) - same reasoning as
-- idx_account_balances_account_captured.
CREATE INDEX idx_vacation_voucher_values_user_valued ON vacation_voucher_values (user_id, valued_at DESC);

-- Manually-tracked savings goals (e.g. "Vacances - 3000€ d'ici juin"),
-- distinct from budgets: a budget caps monthly spend on a category, a goal
-- accumulates toward a target_amount, optionally by target_date.
-- Frontend-only, like assets/debts - the worker never reads or writes this
-- table.
CREATE TABLE savings_goals (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    target_amount NUMERIC(14, 2) NOT NULL,
    target_date   DATE,
    notes         TEXT,
    -- 'once' (default): a fixed target. Tracked either manually (snapshots
    -- in savings_goal_values below, same as assets/debts) or, if
    -- account_internal_id is set, live from that account's current balance
    -- (lib/data.ts getAccounts) - a balance is a level, not a flow, so it
    -- never resets per period the way category-tracked goals do.
    -- 'monthly'/'yearly': a recurring target against category_id - progress
    -- for the current period is computed live from categorized transactions
    -- (see lib/data.ts getSavingsGoals). Fixed set of values enforced by the
    -- app, not a DB constraint (same convention as accounts.type).
    period              TEXT NOT NULL DEFAULT 'once',
    -- category_id and account_internal_id are mutually exclusive tracking
    -- sources, enforced by the app (createSavingsGoal/updateSavingsGoalDetails
    -- in lib/actions.ts) rather than a CHECK constraint.
    category_id         BIGINT REFERENCES categories (id) ON DELETE SET NULL,
    account_internal_id TEXT REFERENCES accounts (internal_id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_savings_goals_user ON savings_goals (user_id);

-- One row per progress snapshot, so a goal's progress can be charted over
-- time - mirrors asset_values/debt_values.
CREATE TABLE savings_goal_values (
    id              BIGSERIAL PRIMARY KEY,
    savings_goal_id BIGINT NOT NULL REFERENCES savings_goals (id) ON DELETE CASCADE,
    value           NUMERIC(14, 2) NOT NULL,
    value_currency  TEXT NOT NULL DEFAULT 'EUR',
    valued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_savings_goal_values_goal_valued ON savings_goal_values (savings_goal_id, valued_at DESC);

-- A recurring monthly spending budget for one category. Frontend-only, like
-- categories - the worker never reads or writes this table. One row per
-- (user, category): editing a budget just updates its amount rather than
-- inserting a new period row, since the same amount recurs every month
-- until changed.
CREATE TABLE budgets (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    category_id BIGINT NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
    amount      NUMERIC(14, 2) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (user_id, category_id)
);

CREATE INDEX idx_budgets_user ON budgets (user_id);

-- Worker-computed forecast of total income for a given calendar month,
-- fit from completed months' totals (see worker/income_forecast.py). One
-- row per (user, period_month); re-synced runs upsert the same month's
-- prediction as long as that month is still in progress. The frontend
-- reads this to show actual-so-far vs. expected-so-far for the current
-- month - the worker is the only writer.
CREATE TABLE income_predictions (
    id               BIGSERIAL PRIMARY KEY,
    user_id          BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    period_month     DATE NOT NULL,
    predicted_amount NUMERIC(14, 2) NOT NULL,
    model            TEXT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE (user_id, period_month)
);

CREATE INDEX idx_income_predictions_user ON income_predictions (user_id);
