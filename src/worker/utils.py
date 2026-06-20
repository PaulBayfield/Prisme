"""Helpers for converting values from the LCL API into PostgreSQL-friendly types."""

from datetime import datetime
from decimal import Decimal


def parse_dt(value: str | None) -> datetime | None:
    """
    Parse an ISO-8601 date string as returned by the LCL API.

    :param value: ISO-8601 date string, or ``None``
    :type value: str or None
    :return: The parsed datetime, or ``None`` if ``value`` is falsy
    :rtype: datetime.datetime or None
    """
    return datetime.fromisoformat(value) if value else None


def to_decimal(value: float | None) -> Decimal | None:
    """
    Convert a float amount from the LCL API into a :class:`decimal.Decimal`.

    Goes through ``str(value)`` rather than ``Decimal(value)`` directly, to
    avoid floating-point artifacts when representing the amount exactly.

    :param value: Amount as returned by the LCL API, or ``None``
    :type value: float or None
    :return: The amount as a Decimal, or ``None`` if ``value`` is ``None``
    :rtype: decimal.Decimal or None
    """
    return Decimal(str(value)) if value is not None else None
