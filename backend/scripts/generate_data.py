"""Seeded CSVs for JP-019. Run from repo root or backend/."""

from __future__ import annotations

import csv
import sys
from pathlib import Path

import numpy as np

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.catalog import CUSTOMERS, DEPOT_ADDRESS, DRIVERS, SKUS, STREETS, ZONE_NAMES, ZONE_PIN

SEED = 19
DEPOT = (12.9716, 77.5946)
ZONES = ("IND", "KOR", "HSR", "WHT", "JPN")
ZONE_CENTERS = {
    "IND": (12.9780, 77.6408),
    "KOR": (12.9352, 77.6245),
    "HSR": (12.9121, 77.6446),
    "WHT": (12.9698, 77.7499),
    "JPN": (12.9250, 77.5830),
}
ZONE_LATE = {"IND": 0.18, "KOR": 0.34, "HSR": 0.27, "WHT": 0.41, "JPN": 0.22}

ROOT = BACKEND / "data"


def _jitter(rng: np.random.Generator, lat: float, lon: float, scale: float = 0.012) -> tuple[float, float]:
    return (
        float(lat + rng.normal(0, scale)),
        float(lon + rng.normal(0, scale)),
    )


def _write_csv(path: Path, rows: list[dict], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)


def vehicles() -> list[dict]:
    dlat, dlon = DEPOT
    rows = []
    caps = (40, 40, 35)
    for i, meta in enumerate(DRIVERS):
        rows.append(
            {
                "vehicle_id": meta["vehicle_id"],
                "capacity": caps[i],
                "depot_lat": dlat,
                "depot_lon": dlon,
                "shift_start": 0,
                "shift_end": 420,
                "driver": meta["driver"],
                "plate": meta["plate"],
                "phone": meta["phone"],
                "rating": meta["rating"],
                "depot_address": DEPOT_ADDRESS,
            }
        )
    return rows


def _enrich(i: int, zone: str, row: dict) -> dict:
    street = STREETS[zone][(i - 1) % len(STREETS[zone])]
    house = 10 + (i * 7) % 80
    row.update(
        {
            "customer": CUSTOMERS[(i - 1) % len(CUSTOMERS)],
            "address": f"{house}, {street}, {ZONE_NAMES[zone]}",
            "pincode": ZONE_PIN[zone],
            "zone_name": ZONE_NAMES[zone],
            "phone": f"+91 98{(i * 13) % 90:02d}24{3000 + i}",
            "sku": SKUS[(i - 1) % len(SKUS)],
            "cod_inr": 0 if row["priority"] == "critical" else 399 + i * 85,
        }
    )
    return row


def orders_a(rng: np.random.Generator) -> list[dict]:
    plan = [
        ("IND", 5, True),
        ("IND", 6, False),
        ("IND", 5, False),
        ("IND", 7, False),
        ("IND", 4, True),
        ("KOR", 6, True),
        ("KOR", 5, False),
        ("KOR", 6, False),
        ("KOR", 5, False),
        ("KOR", 7, False),
        ("JPN", 5, True),
        ("JPN", 6, False),
        ("JPN", 4, False),
        ("JPN", 6, False),
        ("HSR", 5, False),
        ("HSR", 6, False),
    ]
    rows = []
    for i, (zone, demand, critical) in enumerate(plan, start=1):
        lat, lon = _jitter(rng, *ZONE_CENTERS[zone], 0.008)
        start = int(rng.integers(0, 50) + (i % 6) * 18)
        width = int(rng.integers(48, 72))
        rows.append(
            _enrich(
                i,
                zone,
                {
                    "order_id": f"ORD-{i:03d}",
                    "lat": round(lat, 6),
                    "lon": round(lon, 6),
                    "demand": demand,
                    "tw_start": start,
                    "tw_end": start + width,
                    "service_min": int(rng.integers(8, 13)),
                    "priority": "critical" if critical else "normal",
                    "zone": zone,
                },
            )
        )
    return rows


def orders_b(rng: np.random.Generator) -> list[dict]:
    plan = [
        ("IND", 5, True),
        ("IND", 4, True),
        ("IND", 9, False),
        ("IND", 10, False),
        ("IND", 8, False),
        ("KOR", 5, True),
        ("KOR", 11, False),
        ("KOR", 10, False),
        ("KOR", 9, False),
        ("KOR", 8, False),
        ("JPN", 4, True),
        ("JPN", 10, False),
        ("JPN", 9, False),
        ("JPN", 8, False),
        ("HSR", 5, True),
        ("HSR", 11, False),
        ("HSR", 10, False),
        ("HSR", 9, False),
        ("WHT", 6, True),
        ("WHT", 12, False),
        ("WHT", 11, False),
        ("WHT", 10, False),
        ("WHT", 9, False),
        ("WHT", 8, False),
    ]
    rows = []
    for i, (zone, demand, critical) in enumerate(plan, start=1):
        lat, lon = _jitter(rng, *ZONE_CENTERS[zone], 0.007)
        start = int(rng.integers(10, 80) + (i % 6) * 18)
        width = 38 if zone == "WHT" else int(rng.integers(36, 52))
        rows.append(
            _enrich(
                i,
                zone,
                {
                    "order_id": f"ORD-{i:03d}",
                    "lat": round(lat, 6),
                    "lon": round(lon, 6),
                    "demand": demand,
                    "tw_start": start,
                    "tw_end": start + width,
                    "service_min": int(rng.integers(9, 14)),
                    "priority": "critical" if critical else "normal",
                    "zone": zone,
                },
            )
        )
    return rows


def history(rng: np.random.Generator, n: int = 420) -> list[dict]:
    rows = []
    for i in range(n):
        zone = str(rng.choice(ZONES))
        demand = int(rng.integers(4, 13))
        dist = float(np.clip(rng.normal(4.2, 2.1), 0.4, 14.0))
        window = float(np.clip(rng.normal(70, 35), 20, 180))
        load_pct = float(np.clip(rng.beta(2.2, 1.8), 0.15, 1.05))
        seq = int(rng.integers(1, 9))
        slack = float(rng.normal(window * 0.35 - seq * 4 - dist * 1.2, 18))
        travel_var = float(np.clip(rng.gamma(2.0, 3.5), 0.5, 25))
        zone_rate = ZONE_LATE[zone]
        logit = (
            -1.6
            + 2.4 * (1 if window < 45 else 0)
            + 1.8 * zone_rate
            + 0.9 * max(load_pct - 0.8, 0)
            + 0.18 * seq
            + 0.08 * dist
            - 0.03 * slack
            + 0.06 * travel_var
        )
        p = 1 / (1 + np.exp(-logit))
        was_late = int(rng.random() < p)
        delay = 0 if not was_late else int(np.clip(rng.normal(18, 10), 1, 70))
        rows.append(
            {
                "job_id": f"H-{i:04d}",
                "zone": zone,
                "demand": demand,
                "depot_km": round(dist, 3),
                "window_width": round(window, 1),
                "load_pct": round(load_pct, 3),
                "seq_index": seq,
                "eta_slack": round(slack, 1),
                "travel_variance": round(travel_var, 2),
                "zone_late_rate": zone_rate,
                "was_late": was_late,
                "delay_min": delay,
            }
        )
    return rows


def main() -> None:
    rng = np.random.default_rng(SEED)
    order_fields = [
        "order_id",
        "lat",
        "lon",
        "demand",
        "tw_start",
        "tw_end",
        "service_min",
        "priority",
        "zone",
        "zone_name",
        "customer",
        "address",
        "pincode",
        "phone",
        "sku",
        "cod_inr",
    ]
    veh_fields = [
        "vehicle_id",
        "capacity",
        "depot_lat",
        "depot_lon",
        "shift_start",
        "shift_end",
        "driver",
        "plate",
        "phone",
        "rating",
        "depot_address",
    ]
    hist_fields = [
        "job_id",
        "zone",
        "demand",
        "depot_km",
        "window_width",
        "load_pct",
        "seq_index",
        "eta_slack",
        "travel_variance",
        "zone_late_rate",
        "was_late",
        "delay_min",
    ]
    v = vehicles()
    _write_csv(ROOT / "scenario_a" / "vehicles.csv", v, veh_fields)
    _write_csv(ROOT / "scenario_b" / "vehicles.csv", v, veh_fields)
    _write_csv(ROOT / "scenario_a" / "orders.csv", orders_a(rng), order_fields)
    _write_csv(ROOT / "scenario_b" / "orders.csv", orders_b(rng), order_fields)
    _write_csv(ROOT / "history.csv", history(rng), hist_fields)
    print(f"Wrote CSVs under {ROOT}")


if __name__ == "__main__":
    main()
