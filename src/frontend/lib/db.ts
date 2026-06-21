import "server-only";

import { Pool } from "pg";

declare global {
  var pgPool: Pool | undefined;
}

// Reuse the pool across HMR reloads in dev, otherwise each reload leaks a
// new set of connections until Postgres' max_connections is exhausted.
export const pool =
  global.pgPool ??
  new Pool({
    host: process.env.POSTGRES_HOST ?? "localhost",
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    database: process.env.POSTGRES_DATABASE,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  });

if (process.env.NODE_ENV !== "production") {
  global.pgPool = pool;
}
