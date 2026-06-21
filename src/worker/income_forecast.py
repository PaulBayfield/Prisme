"""Forecasts a user's expected income for the current month from past months' totals.

Uses a simple ordinary-least-squares linear regression (``numpy.polyfit``)
over consecutive completed months of income, extrapolated one month
forward. The dataset is tiny (one number per month, for a single user), so
a full ML stack would be overkill - linear regression is the right-sized
tool here.
"""

from datetime import date
from decimal import Decimal

import numpy as np

MODEL_NAME = "linear_regression"


def build_monthly_series(
    totals_by_month: dict[date, Decimal], first_month: date, last_month: date
) -> list[Decimal]:
    """
    Turn a sparse ``{month: total}`` mapping into a complete, gap-filled series.

    ``totals_by_month`` only has entries for months with at least one income
    transaction; a month with none would otherwise be silently skipped,
    which would corrupt the trend fit in :func:`compute_expected_income` by
    making two non-adjacent observed months look consecutive.

    :param totals_by_month: Income total per month that had at least one
        income transaction
    :type totals_by_month: dict[datetime.date, decimal.Decimal]
    :param first_month: First day of the earliest month to include
    :type first_month: datetime.date
    :param last_month: First day of the latest month to include (inclusive)
    :type last_month: datetime.date
    :return: One total per month from ``first_month`` to ``last_month``, in
        order, with missing months filled in as zero
    :rtype: list[decimal.Decimal]
    """
    series = []
    year, month = first_month.year, first_month.month
    while (year, month) <= (last_month.year, last_month.month):
        series.append(totals_by_month.get(date(year, month, 1), Decimal(0)))
        month += 1
        if month > 12:
            year, month = year + 1, 1
    return series


def compute_expected_income(monthly_totals: list[Decimal]) -> Decimal | None:
    """
    Predict next month's income from a series of completed months' totals.

    With two or more months of history, fits a linear trend (least-squares)
    over the series and extrapolates one step past the end. With exactly
    one month, that month's total is carried forward as-is (no trend to
    fit). With no history at all, there is nothing to predict from.

    :param monthly_totals: Total income for each of the most recent
        consecutive completed months, oldest first, gaps included as zero
        (see :func:`build_monthly_series`)
    :type monthly_totals: list[decimal.Decimal]
    :return: The predicted income for the next month, floored at zero, or
        ``None`` if there isn't enough history to predict from
    :rtype: decimal.Decimal or None
    """
    if not monthly_totals:
        return None

    if len(monthly_totals) == 1:
        return max(monthly_totals[0], Decimal(0))

    x = np.arange(len(monthly_totals), dtype=np.float64)
    y = np.array([float(total) for total in monthly_totals], dtype=np.float64)

    slope, intercept = np.polyfit(x, y, 1)
    predicted = slope * len(monthly_totals) + intercept

    return Decimal(str(round(max(predicted, 0.0), 2)))
