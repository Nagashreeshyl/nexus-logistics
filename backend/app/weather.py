"""Open-Meteo (free, no key) current conditions for Bengaluru depot."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any

DEPOT = (12.9716, 77.5946)
URL = (
    "https://api.open-meteo.com/v1/forecast"
    "?latitude=12.9716&longitude=77.5946"
    "&current=temperature_2m,precipitation,weather_code,wind_speed_10m,relative_humidity_2m"
    "&timezone=Asia%2FKolkata"
)

WMO = {
    0: "Clear",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Rime fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    71: "Snow",
    80: "Rain showers",
    95: "Thunderstorm",
}


def fetch_weather(force: bool = False) -> dict[str, Any]:
    from .cache import cache

    if not force:
        hit = cache.get_json("weather:blr")
        if hit:
            hit = dict(hit)
            hit["cached"] = True
            return hit

    fallback = {
        "ok": False,
        "source": "open-meteo",
        "label": "Weather unavailable — using historical variance only",
        "temp_c": None,
        "precip_mm": 0.0,
        "humidity": None,
        "wind_kmh": None,
        "code": None,
        "wet": False,
        "risk_note": "No live weather feed",
        "cached": False,
    }
    try:
        req = urllib.request.Request(URL, headers={"User-Agent": "jp019-vertex/1.0"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())
        cur = data.get("current") or {}
        code = int(cur.get("weather_code") or 0)
        precip = float(cur.get("precipitation") or 0)
        wet = precip > 0 or code in {51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99}
        label = WMO.get(code, f"Code {code}")
        note = "Rain in Bengaluru — travel variance up" if wet else "Dry conditions — no weather penalty"
        out = {
            "ok": True,
            "source": "open-meteo",
            "label": label,
            "temp_c": cur.get("temperature_2m"),
            "precip_mm": precip,
            "humidity": cur.get("relative_humidity_2m"),
            "wind_kmh": cur.get("wind_speed_10m"),
            "code": code,
            "wet": wet,
            "risk_note": note,
            "time": cur.get("time"),
            "cached": False,
        }
        cache.set_json("weather:blr", out, ttl=180)
        return out
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, KeyError):
        return fallback
