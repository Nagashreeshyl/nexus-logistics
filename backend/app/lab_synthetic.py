"""Auth-optional hackathon Lab: generate fresh Bengaluru CVRPTW scenarios."""

from __future__ import annotations

import time
from typing import Any

from .live_scenario import scenario_from_live
from .models import Scenario

DEPOT_LAT = 12.9716
DEPOT_LON = 77.5946

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


def generate_lab_scenario(seed: int | None = None) -> tuple[Scenario, dict[str, Any]]:
    """
    Build a new valid Scenario each call.
    Order/vehicle counts vary; coords are Bengaluru-local; fields match OR-Tools models.
    """
    s = _Seed(seed if seed is not None else int(time.time() * 1000) & 0xFFFFFFFF)

    n_vehicles = 4 + s.rnd(3)  # 4..6
    n_orders = 14 + s.rnd(12)  # 14..25
    # Keep fleet capacity comfortably above demand for reliable demos
    base_cap = 70 + s.rnd(40)

    vehicles: list[dict[str, Any]] = []
    for i in range(n_vehicles):
        cap = base_cap + s.rnd(30)
        vehicles.append(
            {
                "vehicle_id": f"V{i + 1:02d}",
                "capacity": max(60, cap),
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
        # ~18–28% critical
        critical = s.rnd(100) < 22
        tw_start_h = 9 + s.rnd(5)
        tw_width = 3 + s.rnd(4)
        tw_end_h = min(17, tw_start_h + tw_width)
        orders.append(
            {
                "order_id": f"ORD-{1000 + i + s.rnd(8000)}",
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

    # Soft-cap total demand to ~65% of fleet capacity
    total_cap = sum(int(v["capacity"]) for v in vehicles)
    total_dem = sum(int(o["demand"]) for o in orders)
    if total_dem > int(total_cap * 0.65):
        scale = (total_cap * 0.65) / max(1, total_dem)
        for o in orders:
            o["demand"] = max(1, int(int(o["demand"]) * scale))

    scenario_id = f"lab-{s.v:08x}"
    scenario = scenario_from_live(
        scenario_id=scenario_id,
        orders=orders,
        vehicles=vehicles,
        depot_lat=DEPOT_LAT,
        depot_lon=DEPOT_LON,
    )
    scenario.code = "LAB"
    scenario.name = "Synthetic Bengaluru Lab"

    critical_n = sum(1 for o in scenario.orders if o.priority == "critical")
    total_demand = sum(o.demand for o in scenario.orders)
    payload = {
        "scenario_id": scenario.id,
        "seed": s.v,
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
        },
    }
    return scenario, payload
