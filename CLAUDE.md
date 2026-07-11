# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Prisme is a personal money-tracking/monitoring app built around LCL (a French bank) that has no official public API. It works by reverse-engineering LCL's private web API (`https://monespace.lcl.fr/api`) and is split into three components under `src/`, intended to run as a pipeline:

`extension` (capture LCL session credentials) → `worker` (call LCL's API, persist to Postgres) → `frontend` (display the data, behind SSO).

Only `extension` and `worker` exist today; `frontend` is an empty placeholder directory.

## Architecture and data flow

1. **`src/extension`** — a Manifest V3 WebExtension (originally the standalone project "LCL Creds Grabber", vendored in here) that the user runs while logging into `monespace.lcl.fr` in their browser. Its background service worker (`src/background.js`) hooks `webRequest.onBeforeRequest` for `.../api/login` and `.../api/user/accounts*` to capture the login payload (`identifier`, `keypad`, `sessionId`) and `contract_id`, storing them via `browser.storage.local`. The popup (`src/popup.js`) lets the user copy this data, LZString-compressed and AES-encrypted (`crypto-js`) with a passphrase. That passphrase exchange is implemented: the frontend's `LclConnectionPanel` (`src/frontend/components/lcl-connection-panel.tsx`, used from onboarding and Settings → Compte) generates a short-lived passphrase via `createCredentialExchangeRequest`, the user pastes it into the popup's passphrase field, and the encrypted payload copied back is submitted via `submitCredentialPayload`, which decrypts it (same approach as `script/decrypt.py`) and stores the credentials.
2. **`src/worker`** — intended to receive that captured data and use it to drive `src/worker/lib/LCLPy`, a small async reverse-engineered LCL API client (`LCLClient.login` / `getAccounts` / `getSavingsAccounts`, built on `aiohttp`), then write the results to PostgreSQL. `LCLClient` takes its credentials (`identifier`, `keypad`, `session_id`, `contract_id`) as constructor arguments rather than reading them itself — nothing in `LCLPy` touches `.env` or `os.environ`. Account selection is dynamic too: `getAccounts`/`getSavingsAccounts` return `Account` objects (see `objects/account.py`) carrying each account's `internal_id` plus the access token/contract id needed to act on it; call `account.getTransactions()` directly on the account you want rather than passing an account into a client method — there's no fixed "the one account" config anymore. Today the manual smoke-test script (`src/worker/tests/test_client.py`) is what loads `.env` via `python-dotenv` and passes the values into `LCLClient`; wiring real credentials from the extension's encrypted payload, and persisting to Postgres, is not implemented yet, nor is any DB access code.
3. **`src/frontend`** — not started. Per project plan, it will display the data the worker collects and sit behind Authentik SSO.

Because the credential handoff between `extension` and `worker` is half-built, expect to read `src/extension/src/popup.js` and `src/worker/lib/LCLPy/client.py` together when working on that integration — the shapes of the data on each side (`identifier`/`keypad`/`sessionId`/`contract_id` vs. the `.env` vars `ACCOUNT_IDENTIFIER`/`KEYPAD`/`SESSION_ID`/`CONTRACT_ID` used by `tests/test_client.py`) need to line up. `src/worker/script/decrypt.py` reverses the extension's LZString+AES-encrypted clipboard payload back into that `login`/`account` JSON (manual CLI helper — given the payload and the passphrase as args); it's the reference implementation for that decryption step if it gets wired into the worker proper.

This repo deals with a real personal bank account and an unofficial, reverse-engineered API. Treat captured LCL identifiers/keypads/session tokens as live secrets: never log them, commit them, or embed them in generated code/test fixtures. Note `src/worker/.env` exists locally and currently is **not** covered by any `.gitignore` in the repo.

## Components

### Extension (`src/extension`)

WebExtension bundled with webpack (entry points `bundle`/`popup`/`background` defined in `webpack/webpack.common.js`).

```
cd src/extension
npm install
npm run dev      # one-off build, development mode (webpack.dev.js)
npm run watch     # build + watch, development mode
npm run prod      # production build (webpack.prod.js)
npm run zip       # zips dist/ -> LCLCredsGrabber.zip (run after npm run prod)
```

Has its own release-please + dependabot CI (`.github/workflows/extension-release-please.yml`, scoped to `src/extension/**`; `.github/dependabot.yml`) which builds the production bundle, zips it, renames it to `.xpi`, and attaches it to GitHub releases, and also updates `.ff_updates.json` (Firefox self-hosted update manifest).

### Worker (`src/worker`)

Python 3.13, managed with `uv` (`pyproject.toml` + `uv.lock`).

```
cd src/worker
uv sync                 # install deps into .venv
uv run python __main__.py   # run the worker entrypoint
uv run ruff check .     # lint (ruff is the only declared dependency today)
```

No automated/pytest test suite is configured (no test framework dependency present). There's a manual smoke-test script instead — `uv run python tests/test_client.py` loads `.env`, drives a real `LCLClient` against `monespace.lcl.fr`, and prints account/transaction summaries; run it by hand, not in CI. The reverse-engineered LCL client lives at `src/worker/lib/LCLPy` (`LCLClient`, plus `Transaction`/`Transactions` and `Account`/`Accounts` wrappers in `objects/`); it talks to `monespace.lcl.fr/api` directly and is the only piece of code in the worker that knows about LCL's API shape. `pycryptodome` and `lzstring` are dependencies specifically for `script/decrypt.py` (see above), not for `LCLPy`.

### Frontend (`src/frontend`)

Not yet started.
