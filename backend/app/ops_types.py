"""Shared Firestore / RBAC types for Nexus V2."""

from __future__ import annotations

from typing import Literal

Role = Literal["admin", "dispatcher", "driver", "analyst"]
ALL_ROLES: tuple[Role, ...] = ("admin", "dispatcher", "driver", "analyst")

OrderStatus = Literal[
    "CREATED",
    "ASSIGNED",
    "EN_ROUTE",
    "ARRIVED",
    "DELIVERED",
    "FAILED",
    "DEFERRED",
    "CANCELLED",
]

VehicleStatus = Literal["AVAILABLE", "ASSIGNED", "EN_ROUTE", "UNAVAILABLE", "MAINTENANCE"]
DriverStatus = Literal["AVAILABLE", "ASSIGNED", "EN_ROUTE", "OFF_DUTY", "ISSUE"]

COLLECTIONS = (
    "organizations",
    "users",
    "drivers",
    "vehicles",
    "customers",
    "orders",
    "deliveryPlans",
    "routes",
    "stops",
    "deliveries",
    "exceptions",
    "optimizationRuns",
    "metrics",
    "auditLogs",
    "scenarios",
)
