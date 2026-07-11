"""Unit tests for utils.parse_dt and utils.to_decimal."""

from datetime import datetime
from decimal import Decimal

from utils import parse_dt, to_decimal


class TestParseDt:
    def test_parses_iso8601_datetime(self):
        assert parse_dt("2024-03-15T10:30:00") == datetime(2024, 3, 15, 10, 30, 0)

    def test_parses_iso8601_with_timezone(self):
        result = parse_dt("2024-03-15T10:30:00+02:00")
        assert result.year == 2024
        assert result.month == 3
        assert result.day == 15
        assert result.utcoffset() is not None

    def test_none_returns_none(self):
        assert parse_dt(None) is None

    def test_empty_string_returns_none(self):
        assert parse_dt("") is None


class TestToDecimal:
    def test_none_returns_none(self):
        assert to_decimal(None) is None

    def test_zero_is_preserved(self):
        assert to_decimal(0) == Decimal("0")

    def test_negative_value(self):
        assert to_decimal(-42.5) == Decimal("-42.5")

    def test_float_goes_through_str_not_binary_artifact(self):
        # Decimal(0.1) directly would produce the float's binary artifact
        # (0.1000000000000000055511151231257827021181583404541015625);
        # to_decimal must go through str() to avoid that.
        result = to_decimal(0.1)
        assert result == Decimal("0.1")
        assert result != Decimal(0.1)

    def test_integer_amount(self):
        assert to_decimal(100) == Decimal("100")
