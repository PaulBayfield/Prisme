"""Entry point: continuously drains the sync queue and schedules full syncs.

Bridges the worker and frontend, which are separate processes with nothing
in common but Postgres: the frontend enqueues a row in `sync_requests` on
demand (the header's refresh button, or right after a user connects or
reconnects LCL - see src/frontend/lib/actions.ts submitCredentialPayload),
and this loop also enqueues one for every connected user every
FULL_SYNC_INTERVAL. Either way the same drain loop processes it, so one
user's failure is recorded on their request and never blocks the next
user's sync.
"""

import asyncio
from datetime import UTC, datetime, timedelta
from os import environ

import asyncpg
from dotenv import load_dotenv

from worker import Worker, fetch_credentials_for_user

POLL_INTERVAL = timedelta(seconds=10)
FULL_SYNC_INTERVAL = timedelta(minutes=60)


async def enqueue_full_sync(pool: asyncpg.Pool) -> None:
    """
    Enqueue a pending sync request for every user with stored LCL
    credentials, skipping anyone who already has a pending or running
    request so a scheduled tick racing a manual refresh doesn't enqueue a
    duplicate.

    :param pool: PostgreSQL connection pool
    :type pool: asyncpg.Pool
    :return: None
    :rtype: None
    """
    await pool.execute(
        """
        INSERT INTO sync_requests (user_id)
        SELECT c.user_id
        FROM lcl_credentials c
        WHERE NOT EXISTS (
            SELECT 1 FROM sync_requests r
            WHERE r.user_id = c.user_id AND r.status IN ('pending', 'running')
        )
        """
    )


async def process_request(
    pool: asyncpg.Pool, encryption_key: str, request_id: int, user_id: int
) -> None:
    """
    Run one user's sync and record the outcome on their request row.

    Failures are caught here, not at the call site, so one user's error
    (an expired LCL session, say) is recorded on their own request and
    never stops the rest of the queue from being processed.

    :param pool: PostgreSQL connection pool
    :type pool: asyncpg.Pool
    :param encryption_key: pgcrypto passphrase used to decrypt stored credentials
    :type encryption_key: str
    :param request_id: id of the row in ``sync_requests`` being processed
    :type request_id: int
    :param user_id: id of the owning row in ``users``
    :type user_id: int
    :return: None
    :rtype: None
    """
    await pool.execute(
        "UPDATE sync_requests SET status = 'running', started_at = now() WHERE id = $1",
        request_id,
    )

    try:
        credentials = await fetch_credentials_for_user(pool, encryption_key, user_id)
        if credentials is None:
            raise RuntimeError("No LCL credentials stored for this user")

        worker = Worker(
            user_id=credentials.user_id,
            identifier=credentials.identifier,
            keypad=credentials.keypad,
            session_id=credentials.session_id,
            contract_id=credentials.contract_id,
        )
        await worker.run(pool)
    except Exception as exc:
        print(f"Sync failed for user {user_id}: {exc}")
        await pool.execute(
            "UPDATE sync_requests SET status = 'error', error = $2, finished_at = now() WHERE id = $1",
            request_id,
            str(exc)[:2000],
        )
    else:
        print(f"Synced user {user_id}")
        await pool.execute(
            "UPDATE sync_requests SET status = 'success', finished_at = now() WHERE id = $1",
            request_id,
        )


async def main() -> None:
    """
    Load PostgreSQL connection info from ``.env``, then loop forever:
    enqueue a full sync for every connected user every ``FULL_SYNC_INTERVAL``,
    and drain whatever's pending in ``sync_requests`` (those scheduled syncs,
    plus anything the frontend enqueued on demand) every ``POLL_INTERVAL``.

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
    encryption_key = environ["CREDENTIALS_ENCRYPTION_KEY"]

    try:
        next_full_sync = datetime.now(UTC)
        while True:
            try:
                now = datetime.now(UTC)
                if now >= next_full_sync:
                    await enqueue_full_sync(pool)
                    next_full_sync = now + FULL_SYNC_INTERVAL

                pending = await pool.fetch(
                    "SELECT id, user_id FROM sync_requests WHERE status = 'pending' ORDER BY requested_at"
                )
                for row in pending:
                    await process_request(
                        pool, encryption_key, row["id"], row["user_id"]
                    )
            except Exception as exc:
                # A transient DB hiccup or similar shouldn't take the whole
                # daemon down - log it and try again next tick.
                print(f"Sync loop error: {exc}")

            await asyncio.sleep(POLL_INTERVAL.total_seconds())
    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
