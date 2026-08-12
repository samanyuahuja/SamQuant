"""Focused tests for the private API's abuse controls."""

from samquant.api.security import SlidingWindowLimiter, valid_internal_key


def test_internal_key_comparison_rejects_missing_and_wrong_values() -> None:
    assert valid_internal_key("correct", "correct")
    assert not valid_internal_key(None, "correct")
    assert not valid_internal_key("wrong", "correct")


def test_sliding_window_limiter_rejects_requests_over_budget() -> None:
    limiter = SlidingWindowLimiter(requests=2, window_seconds=60)

    assert limiter.allow("caller") == (True, 0)
    assert limiter.allow("caller") == (True, 0)
    allowed, retry_after = limiter.allow("caller")

    assert not allowed
    assert retry_after >= 1
