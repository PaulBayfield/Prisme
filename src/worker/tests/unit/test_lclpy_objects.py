"""Unit tests for lib.LCLPy.objects (Account, Transaction, Accounts,
Transactions).

Covers pulling nested fields out of realistic canned JSON, tolerating
missing/absent nested dicts, and the container protocols (`__len__`,
`__getitem__`, `__iter__`, `__contains__`).
"""

from lib.LCLPy import __baseURL__
from lib.LCLPy.objects import Account, Accounts, Transaction, Transactions

from _fake_aiohttp import make_fake_session_class

RAW_ACCOUNT = {
    "internal_id": "acc-1",
    "external_id": "ext-1",
    "account_number": "00011122233",
    "iban": "FR7630001007941234567890185",
    "label": "Compte courant",
    "short_label": "CC",
    "type": "current",
    "holder_label": "M DUPONT",
    "user_role": "holder",
    "bank_code": "30002",
    "agency_code": "00100",
    "account_creation_date": "2010-01-01",
    "amount": {"value": 1234.56, "currency": "EUR", "date": "2024-03-01"},
    "accounted_amount": {"value": 1200.00, "currency": "EUR", "date": "2024-02-28"},
    "product": {"code": "CC1", "type": "current"},
    "aggregation": False,
}

RAW_TRANSACTION = {
    "id": "txn-1",
    "label": "CB CARREFOUR",
    "detail_labels": ["CARREFOUR", "PARIS"],
    "booking_date_time": "2024-03-01T10:00:00",
    "is_accounted": True,
    "are_details_available": True,
    "amount": {"value": -45.67, "currency": "EUR"},
    "value_date_time": "2024-03-01T10:00:00",
    "movement_code_type": "CARD",
    "nature": "purchase",
}


class TestAccount:
    def test_pulls_nested_fields(self):
        account = Account(RAW_ACCOUNT, access_token="tok", contract_id="contract-1")

        assert account.internal_id == "acc-1"
        assert account.external_id == "ext-1"
        assert account.iban == "FR7630001007941234567890185"
        assert account.amount == 1234.56
        assert account.amount_currency == "EUR"
        assert account.amount_date == "2024-03-01"
        assert account.accounted_amount == 1200.00
        assert account.accounted_amount_currency == "EUR"
        assert account.product_code == "CC1"
        assert account.product_type == "current"
        assert account.aggregation is False

    def test_missing_nested_dicts_do_not_crash(self):
        account = Account({"internal_id": "acc-2"}, access_token="tok", contract_id="c")

        assert account.internal_id == "acc-2"
        assert account.amount is None
        assert account.amount_currency is None
        assert account.amount_date is None
        assert account.accounted_amount is None
        assert account.accounted_amount_currency is None
        assert account.product_code is None
        assert account.product_type is None

    def test_get_object_round_trips_public_fields(self):
        account = Account(RAW_ACCOUNT, access_token="tok", contract_id="contract-1")
        obj = account.getObject()

        assert obj["internal_id"] == "acc-1"
        assert obj["amount"] == 1234.56
        assert obj["product_code"] == "CC1"

    async def test_get_transactions_uses_account_token_and_id(self, mocker):
        calls = {}
        transactions_payload = {
            "accountTransactions": [RAW_TRANSACTION],
        }

        def responder(method, url, **kwargs):
            assert url == f"{__baseURL__}/user/accounts/acc-1/transactions"
            return transactions_payload

        mocker.patch(
            "lib.LCLPy.objects.account.aiohttp.ClientSession",
            make_fake_session_class(calls, responder),
        )

        account = Account(RAW_ACCOUNT, access_token="tok-99", contract_id="contract-1")
        transactions = await account.getTransactions()

        assert isinstance(transactions, Transactions)
        assert len(transactions) == 1

        get_session_headers = calls["session_headers"][0]
        assert get_session_headers["X-Authorization"] == "Bearer tok-99"

        params = calls["requests"][0]["params"]
        assert params["contract_id"] == "contract-1"


class TestTransaction:
    def test_pulls_nested_fields(self):
        transaction = Transaction(RAW_TRANSACTION)

        assert transaction.id == "txn-1"
        assert transaction.label == "CB CARREFOUR"
        assert transaction.amount == -45.67
        assert transaction.amount_currency == "EUR"
        assert transaction.nature == "purchase"

    def test_missing_amount_dict_does_not_crash(self):
        transaction = Transaction({"id": "txn-2", "label": "no amount info"})

        assert transaction.id == "txn-2"
        assert transaction.amount is None
        assert transaction.amount_currency is None

    def test_get_object_round_trips_public_fields(self):
        transaction = Transaction(RAW_TRANSACTION)
        obj = transaction.getObject()

        assert obj["id"] == "txn-1"
        assert obj["amount"] == -45.67


class TestAccounts:
    def test_container_behavior(self):
        accounts = Accounts(
            {
                "total": 2,
                "accounts": [RAW_ACCOUNT, {**RAW_ACCOUNT, "internal_id": "acc-3"}],
            },
            access_token="tok",
            contract_id="contract-1",
        )

        assert len(accounts) == 2
        assert accounts[0].internal_id == "acc-1"
        assert accounts[1].internal_id == "acc-3"
        assert [a.internal_id for a in accounts] == ["acc-1", "acc-3"]
        assert accounts[0] in accounts

    def test_empty_when_accounts_key_absent(self):
        accounts = Accounts({"total": 0}, access_token="tok", contract_id="contract-1")

        assert len(accounts) == 0
        assert list(accounts) == []

    def test_empty_when_accounts_key_is_empty_list(self):
        accounts = Accounts(
            {"total": 0, "accounts": []}, access_token="tok", contract_id="contract-1"
        )

        assert len(accounts) == 0


class TestTransactions:
    def test_container_behavior(self):
        other = {**RAW_TRANSACTION, "id": "txn-2"}
        transactions = Transactions({"accountTransactions": [RAW_TRANSACTION, other]})

        assert len(transactions) == 2
        assert transactions[0].id == "txn-1"
        assert transactions[1].id == "txn-2"
        assert [t.id for t in transactions] == ["txn-1", "txn-2"]
        assert transactions[0] in transactions

    def test_empty_when_key_absent(self):
        transactions = Transactions({})

        assert len(transactions) == 0
        assert list(transactions) == []
