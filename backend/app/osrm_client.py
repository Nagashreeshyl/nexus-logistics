"""Public OSRM (free) road distances and route geometries. Falls back to haversine."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from pathlib import Path

CACHE = Path(__file__).resolve().parents[1] / "data" / "cache"
UA = {"User-Agent": "jp019-vertex/1.0 (hackathon; educational)"}


def _get(url: str, timeout: int = 12) -> dict:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode())


def _loc_key(coords: list[tuple[float, float]]) -> str:
    return ";".join(f"{lat:.5f},{lon:.5f}" for lat, lon in coords)


def table(coords: list[tuple[float, float]]) -> tuple[list[list[float]], list[list[int]]] | None:
    """Return (km matrix, minutes matrix) via OSRM table, or None."""
    if len(coords) < 2:
        return None
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"table_{hash(_loc_key(coords)) & 0xFFFFFFFF:08x}.json"
    if path.exists():
        raw = json.loads(path.read_text())
        return raw["km"], raw["minutes"]
    loc = ";".join(f"{lon},{lat}" for lat, lon in coords)
    url = f"https://router.project-osrm.org/table/v1/driving/{loc}?annotations=duration,distance"
    try:
        data = _get(url)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return None
    if data.get("code") != "Ok":
        return None
    durs = data.get("durations") or []
    dists = data.get("distances") or []
    n = len(coords)
    km = [[0.0] * n for _ in range(n)]
    minutes = [[0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            meters = float(dists[i][j] or 0)
            sec = float(durs[i][j] or 0)
            km[i][j] = round(meters / 1000.0, 3)
            minutes[i][j] = max(1, int(round(sec / 60.0)))
    path.write_text(json.dumps({"km": km, "minutes": minutes}))
    return km, minutes


def route_polyline(points: list[tuple[float, float]]) -> list[tuple[float, float]] | None:
    """Road-snapped lat/lon polyline for a stop sequence."""
    cleaned = [p for p in points if p]
    if len(cleaned) < 2:
        return None
    loc = ";".join(f"{lon},{lat}" for lat, lon in cleaned)
    url = f"https://router.project-osrm.org/route/v1/driving/{loc}?overview=full&geometries=geojson"
    try:
        data = _get(url, timeout=15)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return None
    if data.get("code") != "Ok":
        return None
    routes = data.get("routes") or []
    if not routes:
        return None
    coords = routes[0].get("geometry", {}).get("coordinates") or []
    return [(lat, lon) for lon, lat in coords]
