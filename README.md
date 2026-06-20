# Prisme

> :warning: Work in progress. This is a personal project, not a polished product, expect missing pieces, sharp edges, and breaking changes.

Prisme is a personal money-tracking app built around [LCL](https://www.lcl.fr/), a French bank with no official public API. It works by reverse-engineering LCL's private web API (`monespace.lcl.fr/api`) to pull account and transaction data into a database you control.

## How it works

The project is split into three pieces under `src/`, meant to run as a pipeline:

```
extension  →  worker  →  frontend
(capture)     (fetch &     (display,
              persist)     behind SSO)
```

- **[`src/extension`](src/extension)**: a browser extension you run once while logging into `monespace.lcl.fr`. It captures the session credentials from that login and lets you export them.
- **[`src/worker`](src/worker)**: a Python service that uses those credentials to call LCL's API (balances, transactions, savings accounts) and will persist the results to PostgreSQL.
- **`src/frontend`**: not started yet. Will display the collected data behind Authentik SSO.

Only `extension` and `worker` exist today, and the handoff between them (decrypting the extension's exported payload inside the worker) isn't wired up yet.

## Status

| Component  | Status                                  |
|------------|------------------------------------------|
| extension  | Working, captures and exports credentials |
| worker     | Working client for LCL's API; no DB persistence or credential intake yet |
| frontend   | Not started |

## Disclaimer

This relies on an unofficial, reverse-engineered API and deals with real banking credentials. It's built for personal use against my own account, use at your own risk, and never commit or share captured identifiers, keypads, or session tokens.

## License

[Apache License 2.0](LICENSE)
