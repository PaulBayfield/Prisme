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
-- (see worker/income_forecast.py) to exclude "Remboursement"-tagged
-- transactions from the income forecast.
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

-- Short-lived, single-use passphrase the app hands to the extension so it
-- can AES-encrypt the captured login payload for the user to copy/paste back
-- into the app (the TODO in popup.js). Unrelated to the pgcrypto passphrase
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

CREATE INDEX idx_account_balances_account ON account_balances (account_internal_id);

CREATE TABLE transactions (
    -- row_id is a stable surrogate the frontend can target (e.g. to assign a
    -- category) - id alone isn't unique enough for that, see pk_transactions.
    row_id                BIGSERIAL NOT NULL UNIQUE,
    id                    TEXT NOT NULL,
    account_internal_id   TEXT NOT NULL REFERENCES accounts (internal_id) ON DELETE CASCADE,
    label                 TEXT NOT NULL,
    detail_labels         JSONB,
    booking_date_time     TIMESTAMPTZ NOT NULL,
    value_date_time       TIMESTAMPTZ,
    is_accounted          BOOLEAN,
    are_details_available BOOLEAN,
    amount                NUMERIC(14, 2) NOT NULL,
    amount_currency       TEXT,
    movement_code_type    TEXT,
    nature                TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT pk_transactions PRIMARY KEY (id, label, booking_date_time, amount)
);

CREATE INDEX idx_transactions_account ON transactions (account_internal_id);

-- A transaction can carry several categories (e.g. "Transport" and "Pro"),
-- hence a join table rather than a column on transactions.
CREATE TABLE transaction_categories (
    transaction_row_id BIGINT NOT NULL REFERENCES transactions (row_id) ON DELETE CASCADE,
    category_id        BIGINT NOT NULL REFERENCES categories (id) ON DELETE CASCADE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (transaction_row_id, category_id)
);

CREATE INDEX idx_transaction_categories_category ON transaction_categories (category_id);

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

CREATE INDEX idx_asset_values_asset ON asset_values (asset_id);

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

CREATE INDEX idx_debt_values_debt ON debt_values (debt_id);

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

CREATE INDEX idx_cash_values_user ON cash_values (user_id);

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

CREATE INDEX idx_vacation_voucher_values_user ON vacation_voucher_values (user_id);

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
