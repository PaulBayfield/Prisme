"""Unit tests for lib.LCLPy.client.LCLClient.

None of these hit the network - aiohttp.ClientSession is replaced with the
hand-written fake in _fake_aiohttp.py (see its docstring for why aioresponses
wasn't usable here).
"""

from unittest.mock import AsyncMock

from lib.LCLPy import __baseURL__
from lib.LCLPy.client import LCLClient
from lib.LCLPy.objects import Accounts

from _fake_aiohttp import make_fake_session_class


def make_client() -> LCLClient:
    return LCLClient(
        identifier="ident-1",
        keypad="keypad-1",
        session_id="session-1",
        contract_id="contract-1",
    )


class TestLogin:
    async def test_posts_expected_body_shape(self, mocker):
        calls = {}
        login_payload = {"accessToken": "tok-abc", "expiresIn": 900}

        def responder(method, url, **kwargs):
            assert url == f"{__baseURL__}/login"
            return login_payload

        mocker.patch(
            "lib.LCLPy.client.aiohttp.ClientSession",
            make_fake_session_class(calls, responder),
        )

        client = make_client()
        await client.login()

        assert len(calls["requests"]) == 1
        request = calls["requests"][0]
        assert request["method"] == "POST"
        assert request["url"] == f"{__baseURL__}/login"

        body = request["json"]
        assert body["identifier"] == "ident-1"
        assert body["keypad"] == "keypad-1"
        assert body["sessionId"] == "session-1"
        assert body["encryptedIdentifier"] is False
        assert body["callingUrl"] == "/connexion"
        assert isinstance(body["clientTimestamp"], int)

    async def test_stores_account_data_from_response(self, mocker):
        calls = {}
        login_payload = {"accessToken": "tok-abc", "expiresIn": 900}
        mocker.patch(
            "lib.LCLPy.client.aiohttp.ClientSession",
            make_fake_session_class(calls, lambda *a, **k: login_payload),
        )

        client = make_client()
        assert client.account_data is None

        await client.login()

        assert client.account_data == login_payload


class TestGetAccounts:
    async def test_logs_in_first_when_account_data_missing_and_sends_bearer_token(
        self, mocker
    ):
        calls = {}
        login_payload = {"accessToken": "tok-xyz"}
        accounts_payload = {
            "total": 1,
            "accounts": [
                {
                    "internal_id": "acc-1",
                    "label": "Compte courant",
                    "type": "current",
                    "amount": {"value": 123.45, "currency": "EUR"},
                }
            ],
        }

        def responder(method, url, **kwargs):
            if url.endswith("/login"):
                return login_payload
            if url.endswith("/user/accounts"):
                return accounts_payload
            raise AssertionError(f"unexpected url {url}")

        mocker.patch(
            "lib.LCLPy.client.aiohttp.ClientSession",
            make_fake_session_class(calls, responder),
        )

        client = make_client()
        assert client.account_data is None

        accounts = await client.getAccounts()

        # login() was called first because account_data was None.
        assert client.account_data == login_payload
        requests = calls["requests"]
        assert len(requests) == 2
        assert requests[0]["method"] == "POST"
        assert requests[0]["url"] == f"{__baseURL__}/login"
        assert requests[1]["method"] == "GET"
        assert requests[1]["url"] == f"{__baseURL__}/user/accounts"

        # The GET session must carry the Bearer token from the login response.
        get_session_headers = calls["session_headers"][1]
        assert get_session_headers["X-Authorization"] == "Bearer tok-xyz"

        assert isinstance(accounts, Accounts)
        assert len(accounts) == 1
        assert accounts[0].internal_id == "acc-1"

    async def test_skips_login_when_account_data_already_present(self, mocker):
        calls = {}
        accounts_payload = {"total": 0, "accounts": []}
        mocker.patch(
            "lib.LCLPy.client.aiohttp.ClientSession",
            make_fake_session_class(calls, lambda *a, **k: accounts_payload),
        )

        client = make_client()
        client.account_data = {"accessToken": "already-logged-in"}

        await client.getAccounts()

        requests = calls["requests"]
        assert len(requests) == 1
        assert requests[0]["method"] == "GET"

    async def test_sends_contract_id_and_account_type_params(self, mocker):
        calls = {}
        accounts_payload = {"total": 0, "accounts": []}
        mocker.patch(
            "lib.LCLPy.client.aiohttp.ClientSession",
            make_fake_session_class(calls, lambda *a, **k: accounts_payload),
        )

        client = make_client()
        client.account_data = {"accessToken": "tok"}

        await client.getAccounts(account_type="saving")

        params = calls["requests"][0]["params"]
        assert params["type"] == "saving"
        assert params["contract_id"] == "contract-1"


class TestGetSavingsAccounts:
    async def test_passes_account_type_saving_through_to_get_accounts(self):
        client = make_client()
        client.getAccounts = AsyncMock(return_value="sentinel-accounts")

        result = await client.getSavingsAccounts()

        client.getAccounts.assert_awaited_once_with(account_type="saving")
        assert result == "sentinel-accounts"
