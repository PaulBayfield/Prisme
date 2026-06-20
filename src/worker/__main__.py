"""Entry point: decrypt every stored set of LCL credentials and sync each user."""

import asyncio
from os import environ

import asyncpg
from dotenv import load_dotenv

from worker import Worker, fetch_credentials


async def main() -> None:
    """
    Load PostgreSQL connection info from ``.env``, decrypt every stored set
    of LCL credentials, and run a full sync for each one.

    :return: None
    :rtype: None
    """
    load_dotenv(dotenv_path=".env")

    pool = await asyncpg.create_pool(
        host=environ.get("POSTGRES_HOST", "localhost"),
        port=int(environ.get("POSTGRES_PORT", 5432)),
        database=environ["POSTGRES_DATABASE"],
        user=environ["POSTGRES_USER"],
        password=environ["POSTGRES_PASSWORD"],
    )

    try:
        credentials = await fetch_credentials(pool, environ["CREDENTIALS_ENCRYPTION_KEY"])
        for creds in credentials:
            worker = Worker(
                user_id=creds.user_id,
                identifier=creds.identifier,
                keypad=creds.keypad,
                session_id=creds.session_id,
                contract_id=creds.contract_id,
            )
            await worker.run(pool)
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
