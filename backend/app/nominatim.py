"""Nominatim (OSM) reverse geocoding — free, cached, User-Agent required."""

from __future__ import annotations

import json
import urllib.parse
import urllib.request
from typing import Any

from .cache import cache

UA = "JP019-NexusDispatch/1.2 (hackathon; contact=local)"


def reverse(lat: float, lon: float) -> dict[str, Any]:
    key = f"nominatim:{lat:.5f},{lon:.5f}"
    hit = cache.get_json(key)
    if hit:
        hit = dict(hit)
        hit["cached"] = True
        return hit

    qs = urllib.parse.urlencode(
        {
            "lat": lat,
            "lon": lon,
            "format": "jsonv2",
            "addressdetails": 1,
            "zoom": 16,
        }
    )
    url = f"https://nominatim.openstreetmap.org/reverse?{qs}"
    fallback = {
        "ok": False,
        "source": "nominatim",
        "display_name": "",
        "cached": False,
    }
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode())
        out = {
            "ok": True,
            "source": "nominatim",
            "display_name": data.get("display_name") or "",
            "road": (data.get("address") or {}).get("road"),
            "suburb": (data.get("address") or {}).get("suburb")
            or (data.get("address") or {}).get("neighbourhood"),
            "city": (data.get("address") or {}).get("city")
            or (data.get("address") or {}).get("town"),
            "postcode": (data.get("address") or {}).get("postcode"),
            "cached": False,
        }
        cache.set_json(key, out, ttl=86400)
        return out
    except Exception:
        return fallback
