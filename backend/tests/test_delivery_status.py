"""Delivery state machine unit tests."""

from app.delivery_status import assert_transition, can_transition
import pytest


def test_happy_path():
    assert can_transition("CREATED", "ASSIGNED")
    assert can_transition("ASSIGNED", "EN_ROUTE")
    assert can_transition("EN_ROUTE", "ARRIVED")
    assert can_transition("ARRIVED", "DELIVERED")


def test_invalid_transitions():
    assert not can_transition("CREATED", "DELIVERED")
    assert not can_transition("DELIVERED", "EN_ROUTE")
    assert not can_transition("FAILED", "DELIVERED")
    with pytest.raises(ValueError):
        assert_transition("CREATED", "DELIVERED")


def test_failure_and_recovery():
    assert can_transition("EN_ROUTE", "FAILED")
    assert can_transition("FAILED", "ASSIGNED")
