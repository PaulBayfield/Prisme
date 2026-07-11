"""Unit tests for income_forecast.build_monthly_series, compute_expected_income
and the private _theil_sen helper."""

from datetime import date
from decimal import Decimal

import numpy as np

from income_forecast import _theil_sen, build_monthly_series, compute_expected_income


class TestBuildMonthlySeries:
    def test_single_month(self):
        totals = {date(2024, 3, 1): Decimal("100")}
        result = build_monthly_series(totals, date(2024, 3, 1), date(2024, 3, 1))
        assert result == [Decimal("100")]

    def test_fills_gaps_within_a_year(self):
        totals = {
            date(2024, 1, 1): Decimal("100"),
            date(2024, 3, 1): Decimal("300"),
        }
        result = build_monthly_series(totals, date(2024, 1, 1), date(2024, 3, 1))
        assert result == [Decimal("100"), Decimal(0), Decimal("300")]

    def test_rolls_over_year_boundary(self):
        # Nov -> Dec -> Jan, spanning a year boundary, with Dec missing.
        totals = {
            date(2024, 11, 1): Decimal("100"),
            date(2025, 1, 1): Decimal("300"),
        }
        result = build_monthly_series(totals, date(2024, 11, 1), date(2025, 1, 1))
        assert result == [Decimal("100"), Decimal(0), Decimal("300")]

    def test_no_entries_all_zero(self):
        result = build_monthly_series({}, date(2024, 1, 1), date(2024, 2, 1))
        assert result == [Decimal(0), Decimal(0)]

    def test_ignores_totals_outside_range(self):
        totals = {
            date(2023, 12, 1): Decimal("999"),
            date(2024, 1, 1): Decimal("100"),
        }
        result = build_monthly_series(totals, date(2024, 1, 1), date(2024, 1, 1))
        assert result == [Decimal("100")]


class TestTheilSen:
    def test_perfect_line(self):
        # y = 2x + 1, exactly.
        x = np.array([0.0, 1.0, 2.0, 3.0])
        y = np.array([1.0, 3.0, 5.0, 7.0])
        slope, intercept = _theil_sen(x, y)
        assert slope == 2.0
        assert intercept == 1.0

    def test_hand_computed_example(self):
        # Points: (0, 0), (1, 1), (2, 10) - pairwise slopes are
        # (1-0)/(1-0)=1, (10-0)/(2-0)=5, (10-1)/(2-1)=9 -> median = 5.
        # median(x) = 1, median(y) = 1 -> intercept = 1 - 5*1 = -4.
        x = np.array([0.0, 1.0, 2.0])
        y = np.array([0.0, 1.0, 10.0])
        slope, intercept = _theil_sen(x, y)
        assert slope == 5.0
        assert intercept == -4.0


class TestComputeExpectedIncome:
    def test_no_history_returns_none(self):
        assert compute_expected_income([]) is None

    def test_single_month_carried_forward(self):
        assert compute_expected_income([Decimal("1500")]) == Decimal("1500")

    def test_single_month_floored_at_zero(self):
        assert compute_expected_income([Decimal("-50")]) == Decimal(0)

    def test_two_months_flat_trend(self):
        result = compute_expected_income([Decimal("1000"), Decimal("1000")])
        assert result == Decimal("1000.00") or result == Decimal("1000")
        assert float(result) == 1000.0

    def test_rising_trend_extrapolates(self):
        # Perfectly linear, +100/month -> next value should be 400.
        result = compute_expected_income(
            [Decimal("100"), Decimal("200"), Decimal("300")]
        )
        assert float(result) == 400.0

    def test_result_floored_at_zero(self):
        # Sharp downward trend that would go negative.
        result = compute_expected_income(
            [Decimal("100"), Decimal("50"), Decimal("0")]
        )
        assert float(result) == 0.0

    def test_robust_to_single_outlier_month(self):
        # A steady ~1000/month trend with one spike month (e.g. a bonus).
        # An OLS fit would be dragged noticeably toward the spike; Theil-Sen
        # should stay close to the steady trend instead.
        steady = [Decimal("1000")] * 5
        with_spike = steady.copy()
        with_spike[2] = Decimal("5000")  # one-off spike in the middle

        ols_slope = np.polyfit(
            np.arange(len(with_spike)),
            [float(v) for v in with_spike],
            1,
        )[0]

        robust_result = compute_expected_income(with_spike)
        steady_result = compute_expected_income(steady)

        # The steady series (no outlier) predicts flat ~1000.
        assert float(steady_result) == 1000.0

        # The Theil-Sen prediction should stay close to the steady trend,
        # not get yanked toward the spike the way OLS would.
        assert abs(float(robust_result) - 1000.0) < 50.0

        # Sanity check that the outlier really would have distorted an OLS
        # fit extrapolated the same way, to prove this isn't a vacuous
        # assertion.
        ols_intercept = np.polyfit(
            np.arange(len(with_spike)),
            [float(v) for v in with_spike],
            1,
        )[1]
        ols_predicted = ols_slope * len(with_spike) + ols_intercept
        assert abs(ols_predicted - 1000.0) > 50.0
