/***************************************************************
    *  Prisme - schema.sql
    *  Created by: Paul BAYFIELD
    *  Created on: 19/06/2026
    *  Updated on: 20/06/2026
    *  Description: SQL database scheme for the Prisme project
***************************************************************/


CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id         BIGSERIAL PRIMARY KEY,
    email      TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- identifier/keypad/session_id/contract_id are encrypted with pgp_sym_encrypt
CREATE TABLE lcl_credentials (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    identifier  BYTEA NOT NULL,
    keypad      BYTEA NOT NULL,
    session_id  BYTEA NOT NULL,
    contract_id BYTEA NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lcl_credentials_user ON lcl_credentials (user_id);

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

CREATE TABLE accounts (
    internal_id           TEXT PRIMARY KEY,
    user_id               BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    external_id           TEXT,
    account_number        TEXT,
    iban                  TEXT,
    label                 TEXT,
    short_label           TEXT,
    type                  TEXT,
    holder_label          TEXT,
    user_role             TEXT,
    bank_code             TEXT,
    agency_code           TEXT,
    account_creation_date TIMESTAMPTZ,
    product_code          TEXT,
    product_type          TEXT,
    aggregation           JSONB,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_accounts_user ON accounts (user_id);

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
