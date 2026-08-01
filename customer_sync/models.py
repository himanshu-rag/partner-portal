from dataclasses import dataclass
from datetime import date
from typing import Optional

@dataclass
class Customer:
    """
    Represents a Customer record in both Google Sheets and MySQL.
    """
    customer_name: str
    activation_date: date
    status: str
    storage_gb: int
    id: Optional[int] = None
