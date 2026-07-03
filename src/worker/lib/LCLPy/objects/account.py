import aiohttp

from .. import __baseURL__, __headers__
from .transaction import Transactions


class Account:
    def __init__(self, data: dict, access_token: str, contract_id: str) -> None:
        """
        Objet qui représente un compte bancaire

        :param data: Données du compte
        :param access_token: Jeton d'accès utilisé pour requêter ce compte
        :param contract_id: Identifiant du contrat propriétaire de ce compte
        """
        self.raw = data
        self._access_token = access_token
        self._contract_id = contract_id

        self.internal_id = data.get("internal_id")
        self.external_id = data.get("external_id")
        self.account_number = data.get("account_number")
        self.iban = data.get("iban")
        self.label = data.get("label")
        self.short_label = data.get("short_label")
        self.type = data.get("type")
        self.holder_label = data.get("holder_label")
        self.user_role = data.get("user_role")
        self.bank_code = data.get("bank_code")
        self.agency_code = data.get("agency_code")
        self.account_creation_date = data.get("account_creation_date")
        self.amount = data.get("amount", {}).get("value")
        self.amount_currency = data.get("amount", {}).get("currency")
        self.amount_date = data.get("amount", {}).get("date")
        self.accounted_amount = data.get("accounted_amount", {}).get("value")
        self.accounted_amount_currency = data.get("accounted_amount", {}).get(
            "currency"
        )
        self.accounted_amount_date = data.get("accounted_amount", {}).get("date")
        self.product_code = data.get("product", {}).get("code")
        self.product_type = data.get("product", {}).get("type")
        self.aggregation = data.get("aggregation")

    def __repr__(self) -> str:
        return f"<Account internal_id={self.internal_id} type={self.type} label={self.label} amount={self.amount} currency={self.amount_currency}>"

    def __str__(self) -> str:
        return f"Account internal_id: {self.internal_id} type: {self.type} label: {self.label} amount: {self.amount} currency: {self.amount_currency}"

    async def getTransactions(self, range_: str = "0-99") -> Transactions:
        headers = {
            **__headers__,
            "X-Authorization": f"Bearer {self._access_token}",
        }

        params = {
            "contract_id": self._contract_id,
            "range": range_,
        }

        async with aiohttp.ClientSession(headers=headers) as session:
            async with session.get(
                f"{__baseURL__}/user/accounts/{self.internal_id}/transactions",
                params=params,
            ) as response:
                data = await response.json()

        return Transactions(data)

    def getObject(self) -> dict:
        return {
            "internal_id": self.internal_id,
            "external_id": self.external_id,
            "account_number": self.account_number,
            "iban": self.iban,
            "label": self.label,
            "short_label": self.short_label,
            "type": self.type,
            "holder_label": self.holder_label,
            "user_role": self.user_role,
            "bank_code": self.bank_code,
            "agency_code": self.agency_code,
            "account_creation_date": self.account_creation_date,
            "amount": self.amount,
            "amount_currency": self.amount_currency,
            "amount_date": self.amount_date,
            "accounted_amount": self.accounted_amount,
            "accounted_amount_currency": self.accounted_amount_currency,
            "accounted_amount_date": self.accounted_amount_date,
            "product_code": self.product_code,
            "product_type": self.product_type,
            "aggregation": self.aggregation,
        }


class Accounts:
    def __init__(self, data: dict, access_token: str, contract_id: str):
        """
        Objet qui représente une liste de comptes bancaires

        :param data: Données des comptes
        :param access_token: Jeton d'accès utilisé pour requêter ces comptes
        :param contract_id: Identifiant du contrat propriétaire de ces comptes
        """
        self.raw = data

        self.total = data.get("total")
        self.show_aggregate_account = data.get("show_aggregate_account")
        self.code_aggregation = data.get("code_aggregation")
        self.accounts = (
            [
                Account(account, access_token, contract_id)
                for account in data.get("accounts")
            ]
            if data.get("accounts")
            else []
        )

    def __len__(self) -> int:
        return len(self.accounts)

    def __getitem__(self, index: int) -> Account:
        return self.accounts[index]

    def __iter__(self):
        return iter(self.accounts)

    def __repr__(self) -> str:
        return f"<Accounts count={len(self.accounts)}>"

    def __str__(self) -> str:
        return f"Accounts count: {len(self.accounts)}"

    def __contains__(self, item: Account) -> bool:
        return item in self.accounts
