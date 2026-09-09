from __future__ import annotations

import os

from . import osrm_client
from .models import Order, Vehicle

AVG_KMH = 25.0


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    import math

    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


def travel_minutes(km: float) -> int:
    return max(1, int(round(km / AVG_KMH * 60.0)))


def node_coords(orders: list[Order], vehicle: Vehicle) -> list[tuple[float, float]]:
    return [(vehicle.depot_lat, vehicle.depot_lon)] + [(o.lat, o.lon) for o in orders]


def _haversine_matrices(coords: list[tuple[float, float]]) -> tuple[list[list[float]], list[list[int]]]:
    n = len(coords)
    km = [[0.0] * n for _ in range(n)]
    minutes = [[0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            d = haversine_km(*coords[i], *coords[j])
            km[i][j] = d
            minutes[i][j] = travel_minutes(d)
    return km, minutes


def force_haversine() -> bool:
    """Demo/offline: JP019_TRAVEL=haversine skips OSRM matrix calls."""
    return os.environ.get("JP019_TRAVEL", "").strip().lower() in {"haversine", "offline", "demo"}


def matrices(orders: list[Order], vehicle: Vehicle) -> tuple[list[list[float]], list[list[int]], str]:
    from .cache import cache

    coords = node_coords(orders, vehicle)
    force = force_haversine()
    key = "matrix:" + ("hav:" if force else "") + "|".join(f"{lat:.5f},{lon:.5f}" for lat, lon in coords)
    cached = cache.get_json(key)
    if cached and "km" in cached and "minutes" in cached and "source" in cached:
        return cached["km"], cached["minutes"], cached["source"]

    if not force:
        osrm = osrm_client.table(coords)
        if osrm is not None:
            payload = {"km": osrm[0], "minutes": osrm[1], "source": "osrm"}
            cache.set_json(key, payload, ttl=900)
            return osrm[0], osrm[1], "osrm"
    km, minutes = _haversine_matrices(coords)
    source = "haversine" if force else "haversine_fallback"
    payload = {"km": km, "minutes": minutes, "source": source}
    cache.set_json(key, payload, ttl=900)
    return km, minutes, source
