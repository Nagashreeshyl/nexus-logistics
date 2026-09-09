"""Baseline vs optimized comparison table — same scenario, computed deltas."""

from __future__ import annotations

from typing import Any


# direction: "lower" = lower is better; "higher" = higher is better
METRIC_SPEC: list[dict[str, str]] = [
    {"key": "distance_km", "label": "Distance (km)", "direction": "lower"},
    {"key": "time_min", "label": "Travel time (min)", "direction": "lower"},
    {"key": "late_count", "label": "Late deliveries", "direction": "lower"},
    {"key": "avg_lateness_min", "label": "Avg lateness (min)", "direction": "lower"},
    {"key": "tw_violations", "label": "Time-window violations", "direction": "lower"},
    {"key": "capacity_breaches", "label": "Capacity violations", "direction": "lower"},
    {"key": "unassigned_count", "label": "Orders deferred", "direction": "lower"},
    {"key": "criticals_served", "label": "Critical orders served", "direction": "higher"},
    {"key": "vehicles_used", "label": "Vehicles used", "direction": "lower"},
    {"key": "capacity_utilization", "label": "Capacity utilization", "direction": "context"},
]


def _pct_improvement(baseline: float, optimized: float, direction: str) -> float | None:
    if direction == "context":
        return None
    if baseline == 0 and optimized == 0:
        return 0.0
    if direction == "lower":
        if baseline == 0:
            return None if optimized != 0 else 0.0
        return round(((baseline - optimized) / abs(baseline)) * 100.0, 2)
    if direction == "higher":
        if baseline == 0:
            return None if optimized == 0 else 100.0
        return round(((optimized - baseline) / abs(baseline)) * 100.0, 2)
    return None


def improvement_rows(baseline_metrics: dict[str, Any], optimized_metrics: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for spec in METRIC_SPEC:
        key = spec["key"]
        b = float(baseline_metrics.get(key, 0) or 0)
        o = float(optimized_metrics.get(key, 0) or 0)
        direction = spec["direction"]
        better = (
            "lower is better"
            if direction == "lower"
            else "higher is better"
            if direction == "higher"
            else "context only (not scored as win/loss)"
        )
        imp = _pct_improvement(b, o, direction)
        rows.append(
            {
                "metric": spec["label"],
                "key": key,
                "baseline": round(b, 2) if isinstance(b, float) else b,
                "optimized": round(o, 2) if isinstance(o, float) else o,
                "delta": round(o - b, 2),
                "improvement_pct": imp,
                "better_when": better,
            }
        )
    return rows


def narrative_summary(rows: list[dict[str, Any]]) -> list[str]:
    lines: list[str] = []
    by_key = {r["key"]: r for r in rows}
    for key, label in (
        ("distance_km", "distance"),
        ("late_count", "late deliveries"),
        ("capacity_breaches", "capacity violations"),
        ("tw_violations", "time-window violations"),
    ):
        r = by_key.get(key)
        if not r or r["improvement_pct"] is None:
            continue
        if r["improvement_pct"] > 0:
            lines.append(f"{label}: {r['improvement_pct']}% better vs baseline (lower is better)")
        elif r["improvement_pct"] < 0:
            lines.append(f"{label}: {abs(r['improvement_pct'])}% worse vs baseline")
        else:
            lines.append(f"{label}: unchanged vs baseline")
    crit = by_key.get("criticals_served")
    if crit and crit["improvement_pct"] is not None and crit["improvement_pct"] != 0:
        lines.append(
            f"critical orders served: {crit['improvement_pct']}% "
            f"{'more' if crit['improvement_pct'] > 0 else 'fewer'} vs baseline"
        )
    return lines
