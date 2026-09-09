"""End-to-end JP-019 API flow checks against a running server (or TestClient)."""

from __future__ import annotations

import json
import os
import sys
import urllib.request

os.environ.setdefault("JP019_TRAVEL", "haversine")

BASE = os.environ.get("JP019_API", "http://127.0.0.1:8000")


def req(method: str, path: str, body=None):
    data = None if body is None else json.dumps(body).encode()
    headers = {"Content-Type": "application/json"} if body is not None else {}
    r = urllib.request.Request(BASE + path, data=data, method=method, headers=headers)
    with urllib.request.urlopen(r, timeout=120) as resp:
        raw = resp.read().decode()
        return resp.status, json.loads(raw) if raw else {}


def main() -> int:
    st, h = req("GET", "/api/health")
    assert st == 200 and h["ok"] and "winsheet" in h["features"]
    st, rm = req("GET", "/api/risk/metrics")
    assert "eta_slack" in rm["excluded_features"]
    assert "pre_route_metrics" in rm or "metrics" in rm
    st, base = req("POST", "/api/solve", {"scenario_id": "a", "mode": "baseline"})
    st, opt = req("POST", "/api/solve", {"scenario_id": "a", "mode": "optimize"})
    assert opt["metrics"]["capacity_breaches"] == 0
    st, cmp = req("POST", "/api/compare?scenario_id=a")
    assert cmp["same_scenario"] and len(cmp["comparison"]) >= 8
    st, optb = req("POST", "/api/solve", {"scenario_id": "b", "mode": "optimize"})
    assert optb["partial"] and optb["metrics"]["unassigned_count"] > 0
    print("verify_flows OK")
    print(
        json.dumps(
            {
                "routing": h.get("routing"),
                "a_late_base": base["metrics"]["late_count"],
                "a_late_opt": opt["metrics"]["late_count"],
                "a_km_improvement_pct": next(
                    r["improvement_pct"] for r in cmp["comparison"] if r["key"] == "distance_km"
                ),
                "b_deferred": optb["metrics"]["unassigned_count"],
                "risk_auc": rm.get("metrics", {}).get("roc_auc"),
                "pre_route_auc": (rm.get("pre_route_metrics") or {}).get("roc_auc"),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print("verify_flows FAILED:", exc, file=sys.stderr)
        raise SystemExit(1)
