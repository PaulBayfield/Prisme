"""Manually store a user's LCL credentials in PostgreSQL.

Until the frontend's extension-payload intake flow exists, this is how a row
gets into `lcl_credentials`: takes the same encrypted payload + passphrase
the extension popup produces (see script/decrypt.py), decrypts it, then
re-encrypts identifier/keypad/session_id/contract_id with pgcrypto's
pgp_sym_encrypt using CREDENTIALS_ENCRYPTION_KEY from .env before storing -
see schema.sql. CREDENTIALS_ENCRYPTION_KEY is unrelated to the --passphrase
argument below, which is only the extension's short-lived transport
passphrase used to produce --payload.
"""

import argparse
import asyncio
from os import environ
from pathlib import Path

import asyncpg
from dotenv import load_dotenv

from decrypt import decrypt_extension_payload

DOTENV_PATH = Path(__file__).resolve().parent.parent / ".env"


async def seed(email: str, identifier: str, keypad: str, session_id: str, contract_id: str) -> int:
    """
    Upsert a user by email and insert an encrypted set of LCL credentials for them.

    :param email: Email identifying the user
    :type email: str
    :param identifier: LCL login identifier
    :type identifier: str
    :param keypad: LCL login keypad
    :type keypad: str
    :param session_id: LCL session id
    :type session_id: str
    :param contract_id: LCL contract id
    :type contract_id: str
    :return: id of the inserted lcl_credentials row
    :rtype: int
    """
    pool = await asyncpg.create_pool(
        host=environ.get("POSTGRES_HOST", "localhost"),
        port=int(environ.get("POSTGRES_PORT", 5432)),
        database=environ["POSTGRES_DATABASE"],
        user=environ["POSTGRES_USER"],
        password=environ["POSTGRES_PASSWORD"],
    )

    try:
        credentials_id = await pool.fetchval(
            """
            WITH u AS (
                INSERT INTO users (email) VALUES ($1)
                ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
                RETURNING id
            )
            INSERT INTO lcl_credentials (user_id, identifier, keypad, session_id, contract_id)
            SELECT
                u.id,
                pgp_sym_encrypt($2, $6),
                pgp_sym_encrypt($3, $6),
                pgp_sym_encrypt($4, $6),
                pgp_sym_encrypt($5, $6)
            FROM u
            RETURNING id
            """,
            email,
            identifier,
            keypad,
            session_id,
            contract_id,
            environ["CREDENTIALS_ENCRYPTION_KEY"],
        )
    finally:
        await pool.close()

    return credentials_id


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--email", required=True, help="Email identifying the user")
    parser.add_argument("--payload", required=True, help="Base64 CryptoJS payload copied from the extension popup")
    parser.add_argument("--passphrase", required=True, help="Passphrase the extension used to encrypt --payload")
    args = parser.parse_args()

    data = decrypt_extension_payload(args.payload, args.passphrase)
    login = data.get("login", {})
    account = data.get("account", {})

    load_dotenv(dotenv_path=DOTENV_PATH)
    credentials_id = asyncio.run(seed(
        args.email,
        login.get("identifier"),
        login.get("keypad"),
        login.get("sessionId"),
        account.get("contract_id"),
    ))
    print(f"Stored credentials id={credentials_id} for {args.email}")


if __name__ == "__main__":
    main()
