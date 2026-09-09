"""Build OR-Tools Scenario objects from live operational payloads (Firestore-sourced)."""

from __future__ import annotations

from .models import Order, Priority, Scenario, Vehicle


def _hhmm_to_min(value: str | int | None, default: int) -> int:
    if value is None:
        return default
    if isinstance(value, int):
        return value
    text = str(value).strip()
    if ":" in text:
        h, m = text.split(":", 1)
        return int(h) * 60 + int(m)
    return int(float(text))


def _priority(raw: str | None) -> Priority:
    p = (raw or "normal").upper()
    if p in {"CRITICAL", "HIGH"}:
        return "critical"
    return "normal"


def scenario_from_live(
    *,
    scenario_id: str,
    orders: list[dict],
    vehicles: list[dict],
    depot_lat: float = 12.9716,
    depot_lon: float = 77.5946,
) -> Scenario:
    parsed_orders: list[Order] = []
    for o in orders:
        parsed_orders.append(
            Order(
                order_id=str(o.get("order_id") or o.get("id")),
                lat=float(o["lat"]),
                lon=float(o["lon"]),
                demand=int(float(o.get("demand") or o.get("demandKg") or 1)),
                tw_start=_hhmm_to_min(o.get("tw_start") or o.get("timeWindowStart"), 9 * 60),
                tw_end=_hhmm_to_min(o.get("tw_end") or o.get("timeWindowEnd"), 17 * 60),
                service_min=int(float(o.get("service_min") or o.get("serviceDurationMinutes") or 15)),
                priority=_priority(str(o.get("priority") or "MEDIUM")),
                zone=str(o.get("zone") or "CENTRAL"),
                customer=str(o.get("customer") or o.get("customerName") or ""),
                address=str(o.get("address") or o.get("destination") or ""),
            )
        )

    parsed_vehicles: list[Vehicle] = []
    for v in vehicles:
        parsed_vehicles.append(
            Vehicle(
                vehicle_id=str(v.get("vehicle_id") or v.get("id")),
                capacity=int(float(v.get("capacity") or v.get("capacityKg") or 100)),
                depot_lat=float(v.get("depot_lat") or depot_lat),
                depot_lon=float(v.get("depot_lon") or depot_lon),
                shift_start=_hhmm_to_min(v.get("shift_start"), 8 * 60),
                shift_end=_hhmm_to_min(v.get("shift_end"), 18 * 60),
                driver=str(v.get("driver") or ""),
                plate=str(v.get("plate") or v.get("registrationNumber") or ""),
            )
        )

    if not parsed_vehicles:
        raise ValueError("At least one available vehicle is required")

    return Scenario(
        id=scenario_id,
        code="LIVE",
        name="Live Firestore operations",
        orders=parsed_orders,
        vehicles=parsed_vehicles,
    )
