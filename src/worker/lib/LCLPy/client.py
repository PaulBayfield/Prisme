import aiohttp

from . import __baseURL__, __headers__
from .objects import Accounts
from datetime import datetime


class LCLClient:
    """
    LCL Reverse-Engineering Client
    """
    def __init__(self, identifier: str, keypad: str, session_id: str, contract_id: str) -> None:
        self.identifier = identifier
        self.keypad = keypad
        self.session_id = session_id
        self.contract_id = contract_id

        self.account_data = None


    async def login(self):
        BODY = {
            "identifier": self.identifier,
            "encryptedIdentifier": False,
            "keypad": self.keypad,
            "callingUrl": "/connexion",
            "sessionId": self.session_id,
            "clientTimestamp": int(datetime.now().timestamp()),
        }

        async with aiohttp.ClientSession(headers=__headers__) as session:
            async with session.post(f"{__baseURL__}/login", json=BODY) as response:
                self.account_data = await response.json()


    async def getAccounts(self, account_type: str = "current", include_aggregate_account: bool = True) -> Accounts:
        if self.account_data is None:
            await self.login()

        headers = {
            **__headers__,
            "X-Authorization": f"Bearer {self.account_data['accessToken']}",
        }

        params = {
            "type": account_type,
            "contract_id": self.contract_id,
            "is_eligible_for_identity": "false",
            "include_aggregate_account": str(include_aggregate_account).lower(),
        }

        async with aiohttp.ClientSession(headers=headers) as session:
            async with session.get(f"{__baseURL__}/user/accounts", params=params) as response:
                data = await response.json()

        return Accounts(data, access_token=self.account_data["accessToken"], contract_id=self.contract_id)


    async def getSavingsAccounts(self) -> Accounts:
        return await self.getAccounts(account_type="saving")
