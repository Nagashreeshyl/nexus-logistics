"""Auth-optional hackathon Lab: generate fresh Bengaluru CVRPTW scenarios."""

from __future__ import annotations

import os
import time
from typing import Any, Literal

from .live_scenario import scenario_from_live
from .models import Scenario

# Fixed SQLite id so Lab synthetic days use the same solve/hold/export APIs as Day A/B.
LAB_SCENARIO_ID = "lab"

DEPOT_LAT = 12.9716
DEPOT_LON = 77.5946

Archetype = Literal["balanced", "surge", "tight_windows", "fleet_shortage"]
ARCHETYPES: tuple[str, ...] = ("balanced", "surge", "tight_windows", "fleet_shortage")

ZONES: list[tuple[str, str, float, float]] = [
    ("IND", "Indiranagar", 12.978, 77.640),
    ("KOR", "Koramangala", 12.935, 77.624),
    ("JPN", "Jayanagar", 12.925, 77.583),
    ("HSR", "HSR Layout", 12.912, 77.648),
    ("WHT", "Whitefield", 12.969, 77.750),
    ("CENTRAL", "MG Road", 12.975, 77.606),
]

CUSTOMERS = [
    "Meera Iyer",
    "Rahul Menon",
    "Sana Qureshi",
    "Arjun Deshpande",
    "Lakshmi Rao",
    "Nikhil Sharma",
    "Diya Krishnan",
    "Farhan Ali",
    "Ananya Gupta",
    "Vikram Nair",
    "Pooja Reddy",
    "Karthik Iyer",
]

DRIVERS = ["Asha Rao", "Ravi Kumar", "Meera Iyer", "Arjun Nair", "Priya Shah", "Imran Sheikh"]


class _Seed:
    def __init__(self, v: int) -> None:
        self.v = v & 0xFFFFFFFF

    def next(self) -> int:
        self.v = (1664525 * self.v + 1013904223) & 0xFFFFFFFF
        return self.v

    def rnd(self, n: int) -> int:
        if n <= 0:
            return 0
        return self.next() % n

    def uniform(self, a: float, b: float) -> float:
        return a + (self.next() / 0xFFFFFFFF) * (b - a)


def _normalize_archetype(raw: str | None) -> str:
    key = (raw or "balanced").strip().lower().replace("-", "_").replace(" ", "_")
    if key in {"tight", "windows", "tightwindow", "tight_window"}:
        return "tight_windows"
    if key in {"shortage", "fleet", "short"}:
        return "fleet_shortage"
    if key in ARCHETYPES:
        return key
    return "balanced"


def generate_lab_scenario(
    seed: int | None = None,
    archetype: str | None = None,
) -> tuple[Scenario, dict[str, Any]]:
    """
    Build a new valid Scenario each call.
    Order/vehicle counts vary by archetype; coords are Bengaluru-local; fields match OR-Tools models.
    """
    arch = _normalize_archetype(archetype)
    if seed is None:
        seed = (int(time.time_ns()) ^ (os.getpid() << 16) ^ int(time.time() * 1000)) & 0xFFFFFFFF
    s = _Seed(seed)

    # Archetype knobs — still random within bounds so Load Scenario stays fresh.
    if arch == "surge":
        n_vehicles = 4 + s.rnd(2)  # 4..5
        n_orders = 22 + s.rnd(8)  # 22..29
        base_cap = 55 + s.rnd(25)
        critical_pct = 38
        demand_soft_cap = 0.82
        tw_width_lo, tw_width_hi = 2, 4
    elif arch == "tight_windows":
        n_vehicles = 4 + s.rnd(3)
        n_orders = 16 + s.rnd(8)
        base_cap = 70 + s.rnd(30)
        critical_pct = 28
        demand_soft_cap = 0.70
        tw_width_lo, tw_width_hi = 1, 2
    elif arch == "fleet_shortage":
        n_vehicles = 3
        n_orders = 20 + s.rnd(6)  # 20..25
        base_cap = 50 + s.rnd(20)
        critical_pct = 30
        demand_soft_cap = 0.92
        tw_width_lo, tw_width_hi = 2, 4
    else:  # balanced
        n_vehicles = 4 + s.rnd(3)  # 4..6
        n_orders = 14 + s.rnd(12)  # 14..25
        base_cap = 70 + s.rnd(40)
        critical_pct = 22
        demand_soft_cap = 0.65
        tw_width_lo, tw_width_hi = 3, 6

    vehicles: list[dict[str, Any]] = []
    for i in range(n_vehicles):
        cap = base_cap + s.rnd(30)
        vehicles.append(
            {
                "vehicle_id": f"V{i + 1:02d}",
                "capacity": max(45 if arch == "fleet_shortage" else 60, cap),
                "depot_lat": DEPOT_LAT,
                "depot_lon": DEPOT_LON,
                "shift_start": "08:00",
                "shift_end": "18:00",
                "driver": DRIVERS[s.rnd(len(DRIVERS))],
                "plate": f"KA-{10 + s.rnd(90):02d}-NX-{100 + s.rnd(899)}",
            }
        )

    orders: list[dict[str, Any]] = []
    for i in range(n_orders):
        zone_code, zone_name, zlat, zlon = ZONES[s.rnd(len(ZONES))]
        lat = zlat + s.uniform(-0.012, 0.012)
        lon = zlon + s.uniform(-0.012, 0.012)
        critical = s.rnd(100) < critical_pct
        tw_start_h = 9 + s.rnd(5)
        tw_width = tw_width_lo + s.rnd(max(1, tw_width_hi - tw_width_lo + 1))
        tw_end_h = min(17, tw_start_h + tw_width)
        if arch == "tight_windows" and tw_end_h <= tw_start_h:
            tw_end_h = min(17, tw_start_h + 1)
        orders.append(
            {
                "order_id": f"ORD-{s.v % 9000:04d}-{i + 1:02d}",
                "lat": round(lat, 6),
                "lon": round(lon, 6),
                "demand": 2 + s.rnd(7),
                "tw_start": f"{tw_start_h:02d}:00",
                "tw_end": f"{tw_end_h:02d}:00",
                "service_min": 8 + s.rnd(10),
                "priority": "CRITICAL" if critical else "MEDIUM",
                "zone": zone_code,
                "customer": CUSTOMERS[s.rnd(len(CUSTOMERS))],
                "address": f"{10 + s.rnd(90)} {zone_name} Rd, Bengaluru",
            }
        )

    # Soft-cap total demand relative to fleet capacity (archetype-dependent pressure)
    total_cap = sum(int(v["capacity"]) for v in vehicles)
    total_dem = sum(int(o["demand"]) for o in orders)
    if total_dem > int(total_cap * demand_soft_cap):
        scale = (total_cap * demand_soft_cap) / max(1, total_dem)
        for o in orders:
            o["demand"] = max(1, int(int(o["demand"]) * scale))

    generation_id = f"lab-{s.v:08x}"
    scenario = scenario_from_live(
        scenario_id=LAB_SCENARIO_ID,
        orders=orders,
        vehicles=vehicles,
        depot_lat=DEPOT_LAT,
        depot_lon=DEPOT_LON,
    )
    scenario.code = "LAB"
    names = {
        "balanced": "Synthetic Bengaluru Lab",
        "surge": "Lab · Order surge",
        "tight_windows": "Lab · Tight windows",
        "fleet_shortage": "Lab · Fleet shortage",
    }
    scenario.name = names.get(arch, "Synthetic Bengaluru Lab")

    critical_n = sum(1 for o in scenario.orders if o.priority == "critical")
    total_demand = sum(o.demand for o in scenario.orders)
    payload = {
        "scenario_id": LAB_SCENARIO_ID,
        "generation_id": generation_id,
        "seed": s.v,
        "archetype": arch,
        "code": scenario.code,
        "name": scenario.name,
        "depot": [DEPOT_LAT, DEPOT_LON],
        "depot_address": "Nexus Hub, Richmond Road, Bengaluru",
        "orders": [
            {
                "order_id": o.order_id,
                "lat": o.lat,
                "lon": o.lon,
                "demand": o.demand,
                "tw_start": o.tw_start,
                "tw_end": o.tw_end,
                "service_min": o.service_min,
                "priority": o.priority,
                "zone": o.zone,
                "customer": o.customer,
                "address": o.address,
            }
            for o in scenario.orders
        ],
        "vehicles": [
            {
                "vehicle_id": v.vehicle_id,
                "capacity": v.capacity,
                "depot_lat": v.depot_lat,
                "depot_lon": v.depot_lon,
                "shift_start": v.shift_start,
                "shift_end": v.shift_end,
                "driver": v.driver,
                "plate": v.plate,
            }
            for v in scenario.vehicles
        ],
        "summary": {
            "orders": len(scenario.orders),
            "vehicles": len(scenario.vehicles),
            "critical": critical_n,
            "total_demand": total_demand,
            "archetype": arch,
        },
    }
    return scenario, payload
