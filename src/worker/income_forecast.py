"""Forecasts a user's expected income for the current month from past months' totals.

Uses a Theil-Sen estimator (median of pairwise slopes, see
:func:`_theil_sen`) over consecutive completed months of income,
extrapolated one month forward. The dataset is tiny (one number per month,
for a single user), so a full ML stack would be overkill - but it does
regularly include one-off months (a bonus folded into a paycheck, a
double-payment month) far off the usual trend, which would otherwise yank
an ordinary-least-squares fit (``numpy.polyfit``) toward the outlier;
Theil-Sen tolerates a minority of such points without the prediction
swinging on them.
"""

from datetime import date
from decimal import Decimal

import numpy as np

MODEL_NAME = "theil_sen"


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


def _theil_sen(x: np.ndarray, y: np.ndarray) -> tuple[float, float]:
    """
    Fit a robust trend line via the Theil-Sen estimator.

    The slope is the median of the slopes between every pair of points,
    and the intercept anchors the line through (median(x), median(y)) -
    unlike an ordinary-least-squares fit, a single far-off month can only
    ever be one side of a minority of those pairs, so it can't drag the
    line toward it the way it would drag a least-squares fit.

    :param x: Month index, 0-based
    :type x: numpy.ndarray
    :param y: Total for that month
    :type y: numpy.ndarray
    :return: ``(slope, intercept)``
    :rtype: tuple[float, float]
    """
    i, j = np.triu_indices(len(x), k=1)
    slope = float(np.median((y[j] - y[i]) / (x[j] - x[i])))
    intercept = float(np.median(y) - slope * float(np.median(x)))
    return slope, intercept


def compute_expected_income(monthly_totals: list[Decimal]) -> Decimal | None:
    """
    Predict next month's income from a series of completed months' totals.

    With two or more months of history, fits a robust trend (Theil-Sen, see
    :func:`_theil_sen`) over the series and extrapolates one step past the
    end. With exactly one month, that month's total is carried forward
    as-is (no trend to fit). With no history at all, there is nothing to
    predict from.

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

    slope, intercept = _theil_sen(x, y)
    predicted = slope * len(monthly_totals) + intercept

    return Decimal(str(round(max(predicted, 0.0), 2)))
