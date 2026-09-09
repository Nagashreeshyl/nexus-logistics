"""Delivery status state machine — mirrors frontend/src/lib/deliveryStatus.ts."""

from __future__ import annotations

from typing import Literal

DeliveryStatus = Literal["CREATED", "ASSIGNED", "EN_ROUTE", "ARRIVED", "DELIVERED", "FAILED"]

ALLOWED: dict[DeliveryStatus, tuple[DeliveryStatus, ...]] = {
    "CREATED": ("ASSIGNED", "FAILED"),
    "ASSIGNED": ("EN_ROUTE", "FAILED", "CREATED"),
    "EN_ROUTE": ("ARRIVED", "FAILED"),
    "ARRIVED": ("DELIVERED", "FAILED"),
    "DELIVERED": (),
    "FAILED": ("ASSIGNED",),
}


def can_transition(frm: str, to: str) -> bool:
    if frm == to:
        return False
    allowed = ALLOWED.get(frm)  # type: ignore[arg-type]
    if not allowed:
        return False
    return to in allowed


def assert_transition(frm: str, to: str) -> None:
    if not can_transition(frm, to):
        raise ValueError(f"Invalid delivery transition: {frm} → {to}")
