class Transaction:
    def __init__(self, data: dict) -> None:
        """
        Object qui représente une transaction
        
        :param data: Données de la transaction
        """
        self.raw = data

        self.id = data.get("id")
        self.label = data.get("label")
        self.detail_labels = data.get("detail_labels")
        self.booking_date_time = data.get("booking_date_time")
        self.is_accounted = data.get("is_accounted")
        self.are_details_available = data.get("are_details_available")
        self.amount = data.get("amount", {}).get("value")
        self.amount_currency = data.get("amount", {}).get("currency")
        self.value_date_time = data.get("value_date_time")
        self.movement_code_type = data.get("movement_code_type")
        self.nature = data.get("nature")


    def __repr__(self) -> str:
        return f"<Transaction id={self.id} booking_date_time={self.booking_date_time} label={self.label} amount={self.amount} currency={self.amount_currency}>"


    def __str__(self) -> str:
        return f"Transaction id: {self.id} booking_date_time: {self.booking_date_time} label: {self.label} amount: {self.amount} currency: {self.amount_currency}"


    def getObject(self) -> dict:
        return {
            "id": self.id,
            "label": self.label,
            "detail_labels": self.detail_labels,
            "booking_date_time": self.booking_date_time,
            "is_accounted": self.is_accounted,
            "are_details_available": self.are_details_available,
            "amount": self.amount,
            "amount_currency": self.amount_currency,
            "value_date_time": self.value_date_time,
            "movement_code_type": self.movement_code_type,
            "nature": self.nature
        }


class Transactions:
    def __init__(self, data: dict):
        """
        Object qui représente une liste de transactions
        
        :param data: Données des transactions
        """
        self.raw = data

        self.transactions = [Transaction(transaction) for transaction in data.get("accountTransactions")] if data.get("accountTransactions") else []


    def __len__(self) -> int:
        return len(self.transactions)


    def __getitem__(self, index: int) -> Transaction:
        return self.transactions[index]


    def __iter__(self):
        return iter(self.transactions)


    def __repr__(self) -> str:
        return f"<Transactions count={len(self.transactions)}>"


    def __str__(self) -> str:
        return f"Transactions count: {len(self.transactions)}"


    def __contains__(self, item: Transaction) -> bool:
        return item in self.transactions
