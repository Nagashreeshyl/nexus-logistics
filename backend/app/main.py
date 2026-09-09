from __future__ import annotations

import csv
import hashlib
import json
import os
from io import StringIO
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse

from . import db
from .baseline import run_baseline
from .cache import cache
from .compare import improvement_rows, narrative_summary
from .data_loader import list_scenarios, load_scenario
from .distance import force_haversine
from .lab_synthetic import generate_lab_scenario
from .live_scenario import scenario_from_live
from .metrics import snap_roads
from .models import (
    HoldRequest,
    Order,
    Scenario,
    ScenarioDetailOut,
    ScenarioMetaOut,
    SolutionOut,
    SolveRequest,
)
from pydantic import BaseModel, Field
from .nominatim import reverse as nominatim_reverse
from .ops_api import router as ops_router
from .optimizer import run_optimize
from .firebase_app import auth_mode, firebase_auth_ready, firebase_configured, init_firebase
from .risk import DATA_DISCLOSURE, RiskModel
from .weather import fetch_weather

_LOCALHOST_ORIGINS = [
    "http://127.0.0.1:5173",
    "http://localhost:5173",
]
_ENV_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
_CORS_ORIGINS = list(dict.fromkeys([*_LOCALHOST_ORIGINS, *_ENV_ORIGINS]))

app = FastAPI(title="JP-019 Nexus Last-Mile", version="2.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(ops_router)

risk_model = RiskModel()
WEATHER: dict[str, Any] = {}


@app.on_event("startup")
def _startup() -> None:
    global WEATHER
    db.init_db()
    init_firebase()  # no-op if credentials missing
    WEATHER = fetch_weather()


def _apply_holds(scenario: Scenario) -> Scenario:
    held = set(db.get_holds(scenario.id))
    if not held:
        return scenario
    scenario.orders = [o for o in scenario.orders if o.order_id not in held]
    return scenario


def _holds_fingerprint(scenario_id: str) -> str:
    return ",".join(db.get_holds(scenario_id))


def _solve_cache_key(scenario_id: str, mode: str) -> str:
    raw = f"{scenario_id}:{mode}:{_holds_fingerprint(scenario_id)}:{WEATHER.get('wet')}"
    return "solve:" + hashlib.sha1(raw.encode()).hexdigest()


def _solve_internal(scenario_id: str, mode: str, use_cache: bool = True):
    key = _solve_cache_key(scenario_id, mode)
    if use_cache:
        hit = cache.get_json(key)
        if hit:
            # Reconstruct is heavy; store full SolutionOut dict and return via wrapper
            return ("cached", hit)

    scenario = load_scenario(scenario_id)
    scenario = _apply_holds(scenario)
    if mode == "baseline":
        solution = run_baseline(scenario)
    else:
        triage = risk_model.triage_map(scenario.orders, scenario.vehicles)
        solution = run_optimize(scenario, triage_scores=triage)
    solution = risk_model.attach(solution, scenario.orders, scenario.vehicles)
    if WEATHER.get("wet"):
        for route in solution.routes:
            for stop in route.stops:
                if stop.risk:
                    stop.risk.reasons = [WEATHER["risk_note"], *stop.risk.reasons][:3]
                    stop.risk.p_late = min(0.99, round(stop.risk.p_late + 0.08, 3))
    solution = snap_roads(solution)
    out = _to_out(solution)
    payload = out.model_dump()
    cache.set_json(key, payload, ttl=600)
    db.save_solve(scenario_id, mode, solution.travel_source, solution.metrics.__dict__, payload)
    return ("fresh", out)


def _briefing_from_out(payload: dict[str, Any]) -> dict[str, Any]:
    m = payload["metrics"]
    high_risk = []
    for r in payload["routes"]:
        for s in r["stops"]:
            risk = s.get("risk")
            if risk and risk.get("p_late", 0) >= 0.55:
                high_risk.append(
                    {
                        "order_id": s["order_id"],
                        "customer": s.get("customer"),
                        "p_late": risk["p_late"],
                        "van": r["vehicle_id"],
                    }
                )
    high_risk.sort(key=lambda x: -x["p_late"])
    drivers = [
        {
            "vehicle_id": r["vehicle_id"],
            "driver": r.get("driver"),
            "plate": r.get("plate"),
            "stops": len(r["stops"]),
            "load": r["load"],
            "capacity": r["capacity"],
            "last_eta": r["stops"][-1]["eta_min"] if r["stops"] else None,
            "lates": sum(1 for s in r["stops"] if s["late"]),
            "cod_total": sum(s.get("cod_inr", 0) for s in r["stops"]),
        }
        for r in payload["routes"]
    ]
    lines = [
        f"Mode={payload['mode']} travel={payload.get('travel_source')}",
        f"Late={m['late_count']} breaches={m['hard_breaches']} deferred={m['unassigned_count']}",
        f"Distance={m['distance_km']:.1f} km · {m['time_min']} min · criticals={m['criticals_served']}",
    ]
    if payload.get("partial"):
        lines.append("Partial feasible plan — capacity/windows not relaxed.")
    if high_risk:
        lines.append(f"High late-risk stops: {len(high_risk)}")
    return {
        "headline": " · ".join(lines[:2]),
        "lines": lines,
        "high_risk": high_risk[:8],
        "drivers": drivers,
        "cod_collectible": sum(d["cod_total"] for d in drivers),
        "held": db.get_holds(payload["scenario_id"]),
        "weather": WEATHER,
    }


@app.get("/api/health")
def health() -> dict[str, Any]:
    travel_pref = "haversine (demo/offline)" if force_haversine() else "osrm→haversine_fallback"
    fb_ok = firebase_configured()
    return {
        "ok": True,
        "version": "2.5.0",
        "firebase": {
            "configured": fb_ok,
            "initialized": init_firebase() if fb_ok else False,
            "auth_ready": firebase_auth_ready(),
            "auth_mode": auth_mode(),
        },
        "weather": WEATHER,
        "routing": travel_pref,
        "force_haversine": force_haversine(),
        "data_disclosure": DATA_DISCLOSURE,
        "cache": cache.info(),
        "db": db.db_stats(),
        "features": [
            "sqlite",
            "redis-or-memory-cache",
            "baseline",
            "optimize",
            "compare",
            "winsheet",
            "risk-metrics",
            "holds",
            "manifest",
            "geojson",
            "briefing",
            "weather-refresh",
            "solve-history",
            "firebase-foundation",
            "ops-repository",
            "rbac",
            "active-role-switch",
            "realtime-firestore",
            "delivery-state-machine",
            "lab-synthetic",
            "lab-run",
        ],
    }


class LabRunBody(BaseModel):
    """In-memory Lab scenario payload — auth-optional hackathon path."""

    scenario_id: str = "lab"
    orders: list[dict[str, Any]] = Field(default_factory=list)
    vehicles: list[dict[str, Any]] = Field(default_factory=list)
    exclude_vehicle_ids: list[str] = Field(default_factory=list)
    depot_lat: float = 12.9716
    depot_lon: float = 77.5946


@app.post("/api/lab/synthetic")
def lab_synthetic(seed: int | None = Query(default=None)) -> dict[str, Any]:
    """Generate a NEW Bengaluru CVRPTW scenario (not static A/B)."""
    _, payload = generate_lab_scenario(seed)
    return payload


@app.post("/api/lab/run")
def lab_run(body: LabRunBody) -> dict[str, Any]:
    """
    Real baseline + OR-Tools optimize + ML risk on a Lab payload.
    Auth-optional for hackathon demo; same engines as /api/ops/optimize-live.
    """
    vehicles = [v for v in body.vehicles if str(v.get("vehicle_id") or v.get("id")) not in set(body.exclude_vehicle_ids)]
    if not body.orders:
        raise HTTPException(status_code=400, detail="No orders in scenario")
    if not vehicles:
        raise HTTPException(status_code=400, detail="No vehicles available after exclusions")
    try:
        scenario = scenario_from_live(
            scenario_id=body.scenario_id or "lab",
            orders=body.orders,
            vehicles=vehicles,
            depot_lat=body.depot_lat,
            depot_lon=body.depot_lon,
        )
        scenario.code = "LAB"
        scenario.name = "Synthetic Bengaluru Lab"
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        baseline = snap_roads(risk_model.attach(run_baseline(scenario), scenario.orders, scenario.vehicles))
        triage = risk_model.triage_map(scenario.orders, scenario.vehicles)
        optimized = snap_roads(
            risk_model.attach(
                run_optimize(scenario, time_limit_s=10, triage_scores=triage),
                scenario.orders,
                scenario.vehicles,
            )
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    base_out = _to_out(baseline)
    opt_out = _to_out(optimized)
    rows = improvement_rows(base_out.metrics.model_dump(), opt_out.metrics.model_dump())
    return {
        "scenario_id": scenario.id,
        "excluded_vehicles": list(body.exclude_vehicle_ids),
        "feasible": optimized.feasible,
        "partial": optimized.partial,
        "baseline": base_out.model_dump(),
        "optimize": opt_out.model_dump(),
        "comparison": rows,
        "improvements": narrative_summary(rows),
        "data_disclosure": DATA_DISCLOSURE,
        "travel_source": {
            "baseline": base_out.travel_source,
            "optimize": opt_out.travel_source,
        },
        "ml_metrics": risk_model.evaluation(),
        "triage_note": "ML triage may prefer risky normals when capacity allows; it never relaxes hard constraints.",
    }


@app.get("/api/risk/metrics")
def risk_metrics() -> dict[str, Any]:
    """Holdout evaluation for the late-risk model (synthetic history)."""
    return risk_model.evaluation()


@app.get("/api/winsheet")
def winsheet(scenario_id: str = Query("a")) -> dict[str, Any]:
    """Judge-facing win sheet: problem, method, measured improvement, limitations."""
    try:
        _, base = _solve_internal(scenario_id, "baseline")
        _, opt = _solve_internal(scenario_id, "optimize")
    except KeyError as exc:
        raise HTTPException(status_code=400, detail="unknown scenario") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    base_out = base if isinstance(base, SolutionOut) else SolutionOut.model_validate(base)
    opt_out = opt if isinstance(opt, SolutionOut) else SolutionOut.model_validate(opt)
    rows = improvement_rows(base_out.metrics.model_dump(), opt_out.metrics.model_dump())
    risk_eval = risk_model.evaluation()
    return {
        "scenario_id": scenario_id,
        "problem": (
            "JP-019 last-mile: too many timed deliveries, limited van capacity, and hard customer "
            "time windows. Naive packing creates late, over-capacity, or inefficient plans."
        ),
        "built": (
            "Constraint-aware OR-Tools CVRPTW optimizer with hard capacity and hard time windows, "
            "a critical-first baseline heuristic for comparison, sklearn late-risk overlay for triage, "
            "and partial/deferred fallback when a full feasible plan does not exist."
        ),
        "why_intelligent": [
            "OR-Tools enforces capacity and time windows as hard constraints (not soft heuristics).",
            "Late-risk ML ranks stops and lightly influences drop priority; it never relaxes constraints.",
            "Critical deliveries receive higher protection via disjunction penalties.",
            "When capacity is insufficient, the solver returns a partial plan + deferred list + reasons.",
        ],
        "measured": rows,
        "improved": narrative_summary(rows),
        "when_no_perfect_solution": {
            "partial": opt_out.partial,
            "deferred_count": opt_out.metrics.unassigned_count,
            "constraint_log": [c.model_dump() for c in opt_out.constraint_log][:12],
            "note": "Hard constraints are never relaxed; unserved orders are deferred with recorded reasons.",
        },
        "data_used": DATA_DISCLOSURE,
        "risk_model": {
            "holdout_metrics": risk_eval.get("metrics"),
            "pre_route_metrics": risk_eval.get("pre_route_metrics"),
            "pre_route_features": risk_eval.get("pre_route_features"),
            "excluded_features": risk_eval.get("excluded_features"),
            "not_production_validated": True,
        },
        "baseline_note": (
            "BASELINE = critical-first first-fit packing + nearest-neighbor sequencing. "
            "It can violate capacity; that is intentional so the comparison is honest."
        ),
        "optimized_note": (
            "OPTIMIZED = OR-Tools CVRPTW. Solutions are good feasible plans under a time limit; "
            "not claimed globally optimal unless proven."
        ),
        "limitations": [
            "Historical late labels are synthetic demonstration data.",
            "No real fleet GPS telemetry or production ML validation.",
            "Travel times may use public OSRM or haversine fallback.",
            "Optimizer uses a search time limit; not a proof of global optimality.",
            "Weather and geocoding depend on public APIs when online.",
        ],
        "travel_source_baseline": base_out.travel_source,
        "travel_source_optimize": opt_out.travel_source,
        "baseline_metrics": base_out.metrics.model_dump(),
        "optimize_metrics": opt_out.metrics.model_dump(),
    }


@app.get("/api/weather")
def weather() -> dict[str, Any]:
    return WEATHER


@app.post("/api/weather/refresh")
def weather_refresh() -> dict[str, Any]:
    global WEATHER
    cache.delete("weather:blr")
    WEATHER = fetch_weather(force=True)
    return WEATHER


@app.get("/api/scenarios", response_model=list[ScenarioMetaOut])
def scenarios() -> list[ScenarioMetaOut]:
    out = []
    for s in list_scenarios():
        out.append(
            ScenarioMetaOut(
                id=s.id,
                code=s.code,
                name=s.name,
                order_count=len(s.orders),
                vehicle_count=len(s.vehicles),
            )
        )
    return out


@app.get("/api/scenarios/{scenario_id}", response_model=ScenarioDetailOut)
def scenario_detail(scenario_id: str) -> ScenarioDetailOut:
    try:
        s = load_scenario(scenario_id)
    except KeyError as exc:
        raise HTTPException(status_code=400, detail="unknown scenario") from exc
    depot = [s.vehicles[0].depot_lat, s.vehicles[0].depot_lon]
    geo = nominatim_reverse(depot[0], depot[1])
    return ScenarioDetailOut(
        id=s.id,
        code=s.code,
        name=s.name,
        depot=depot,
        depot_address=s.vehicles[0].depot_address,
        orders=[_order_out(o) for o in s.orders],
        vehicles=[v.__dict__ for v in s.vehicles],
        held=db.get_holds(s.id),
        weather=WEATHER,
        depot_geo=geo,
    )


@app.post("/api/holds")
def set_hold(req: HoldRequest) -> dict[str, Any]:
    try:
        load_scenario(req.scenario_id)
    except KeyError as exc:
        raise HTTPException(status_code=400, detail="unknown scenario") from exc
    held = db.set_hold(req.scenario_id, req.order_id, req.held)
    # invalidate solve cache for scenario by bumping via holds fingerprint (keys differ automatically)
    return {"held": held}


@app.delete("/api/holds/{scenario_id}")
def clear_holds(scenario_id: str) -> dict[str, Any]:
    try:
        load_scenario(scenario_id)
    except KeyError as exc:
        raise HTTPException(status_code=400, detail="unknown scenario") from exc
    return {"held": db.clear_holds(scenario_id)}


@app.post("/api/solve", response_model=SolutionOut)
def solve(req: SolveRequest) -> SolutionOut:
    if req.mode not in ("baseline", "optimize"):
        raise HTTPException(status_code=400, detail="unknown mode")
    try:
        kind, result = _solve_internal(req.scenario_id, req.mode)
    except KeyError as exc:
        raise HTTPException(status_code=400, detail="unknown scenario") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    if kind == "cached":
        out = SolutionOut.model_validate(result)
        return out
    return result  # type: ignore[return-value]


@app.post("/api/compare")
def compare(scenario_id: str = Query(...)) -> dict[str, Any]:
    try:
        _, base = _solve_internal(scenario_id, "baseline")
        _, opt = _solve_internal(scenario_id, "optimize")
    except KeyError as exc:
        raise HTTPException(status_code=400, detail="unknown scenario") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    base_out = base if isinstance(base, SolutionOut) else SolutionOut.model_validate(base)
    opt_out = opt if isinstance(opt, SolutionOut) else SolutionOut.model_validate(opt)
    bm, om = base_out.metrics, opt_out.metrics
    opt_payload = opt_out.model_dump()
    rows = improvement_rows(bm.model_dump(), om.model_dump())
    return {
        "scenario_id": scenario_id,
        "same_scenario": True,
        "labels": {
            "baseline": "BASELINE — simple heuristic planner (may violate capacity)",
            "optimized": "OPTIMIZED — constraint-aware OR-Tools planner",
        },
        "baseline": base_out.model_dump(),
        "optimize": opt_payload,
        "comparison": rows,
        "improvements": narrative_summary(rows),
        "deltas": {
            "late_count": om.late_count - bm.late_count,
            "distance_km": round(om.distance_km - bm.distance_km, 2),
            "time_min": om.time_min - bm.time_min,
            "hard_breaches": om.hard_breaches - bm.hard_breaches,
            "unassigned_count": om.unassigned_count - bm.unassigned_count,
            "criticals_served": om.criticals_served - bm.criticals_served,
            "avg_lateness_min": round(om.avg_lateness_min - bm.avg_lateness_min, 2),
            "capacity_breaches": om.capacity_breaches - bm.capacity_breaches,
            "tw_violations": om.tw_violations - bm.tw_violations,
            "vehicles_used": om.vehicles_used - bm.vehicles_used,
        },
        "data_disclosure": DATA_DISCLOSURE,
        "travel_source": {
            "baseline": base_out.travel_source,
            "optimize": opt_out.travel_source,
        },
        "briefing": _briefing_from_out(opt_payload),
        "cache": cache.info(),
    }


@app.get("/api/briefing")
def briefing(scenario_id: str = Query(...), mode: str = Query("optimize")) -> dict[str, Any]:
    if mode not in ("baseline", "optimize"):
        raise HTTPException(status_code=400, detail="unknown mode")
    try:
        kind, result = _solve_internal(scenario_id, mode)
    except KeyError as exc:
        raise HTTPException(status_code=400, detail="unknown scenario") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    payload = result if isinstance(result, dict) else result.model_dump()
    return _briefing_from_out(payload)


@app.get("/api/history")
def history(scenario_id: str = Query(...), limit: int = Query(10, ge=1, le=50)) -> dict[str, Any]:
    with db.db() as conn:
        rows = conn.execute(
            """
            SELECT id, scenario_id, mode, travel_source, metrics_json, created_at
            FROM solve_runs WHERE scenario_id=?
            ORDER BY id DESC LIMIT ?
            """,
            (scenario_id, limit),
        ).fetchall()
    return {
        "items": [
            {
                "id": r["id"],
                "scenario_id": r["scenario_id"],
                "mode": r["mode"],
                "travel_source": r["travel_source"],
                "metrics": json.loads(r["metrics_json"]),
                "created_at": r["created_at"],
            }
            for r in rows
        ]
    }


@app.get("/api/geojson")
def geojson(scenario_id: str = Query(...), mode: str = Query("optimize")) -> JSONResponse:
    if mode not in ("baseline", "optimize"):
        raise HTTPException(status_code=400, detail="unknown mode")
    try:
        kind, result = _solve_internal(scenario_id, mode)
        scenario = load_scenario(scenario_id)
    except KeyError as exc:
        raise HTTPException(status_code=400, detail="unknown scenario") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    payload = result if isinstance(result, dict) else result.model_dump()
    features: list[dict[str, Any]] = []
    depot = scenario.vehicles[0]
    features.append(
        {
            "type": "Feature",
            "properties": {"kind": "depot", "name": depot.depot_address},
            "geometry": {"type": "Point", "coordinates": [depot.depot_lon, depot.depot_lat]},
        }
    )
    for r in payload["routes"]:
        if len(r["polyline"]) > 1:
            features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "kind": "route",
                        "vehicle_id": r["vehicle_id"],
                        "driver": r.get("driver"),
                        "plate": r.get("plate"),
                    },
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [[p[1], p[0]] for p in r["polyline"]],
                    },
                }
            )
        for s in r["stops"]:
            features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "kind": "stop",
                        "order_id": s["order_id"],
                        "customer": s.get("customer"),
                        "vehicle_id": r["vehicle_id"],
                        "late": s["late"],
                        "eta_min": s["eta_min"],
                        "risk": (s.get("risk") or {}).get("p_late"),
                    },
                    "geometry": {"type": "Point", "coordinates": [s["lon"], s["lat"]]},
                }
            )
    for u in payload["unassigned"]:
        features.append(
            {
                "type": "Feature",
                "properties": {"kind": "deferred", "order_id": u["order_id"], "customer": u.get("customer")},
                "geometry": {"type": "Point", "coordinates": [u["lon"], u["lat"]]},
            }
        )
    return JSONResponse({"type": "FeatureCollection", "features": features, "cached": kind == "cached"})


@app.get("/api/manifest", response_class=PlainTextResponse)
def manifest(scenario_id: str = Query(...), mode: str = Query("optimize")) -> str:
    if mode not in ("baseline", "optimize"):
        raise HTTPException(status_code=400, detail="unknown mode")
    try:
        kind, result = _solve_internal(scenario_id, mode)
    except KeyError as exc:
        raise HTTPException(status_code=400, detail="unknown scenario") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    sol = result if isinstance(result, dict) else result.model_dump()
    buf = StringIO()
    w = csv.writer(buf)
    w.writerow(
        [
            "vehicle",
            "driver",
            "plate",
            "seq",
            "order_id",
            "customer",
            "address",
            "eta",
            "window_end",
            "sku",
            "cod",
            "late",
            "risk",
        ]
    )
    for r in sol["routes"]:
        for s in r["stops"]:
            risk = (s.get("risk") or {}).get("p_late", "")
            w.writerow(
                [
                    r["vehicle_id"],
                    r.get("driver"),
                    r.get("plate"),
                    s["seq"],
                    s["order_id"],
                    s.get("customer"),
                    s.get("address"),
                    s["eta_min"],
                    s["tw_end"],
                    s.get("sku"),
                    s.get("cod_inr"),
                    s["late"],
                    risk,
                ]
            )
    for u in sol["unassigned"]:
        w.writerow(
            [
                "DEFERRED",
                "",
                "",
                "",
                u["order_id"],
                u.get("customer"),
                u.get("address"),
                "",
                u["tw_end"],
                u.get("sku"),
                u.get("cod_inr"),
                "",
                "",
            ]
        )
    return buf.getvalue()


def _order_out(o: Order) -> dict[str, Any]:
    return o.__dict__


def _to_out(solution) -> SolutionOut:
    routes = []
    for r in solution.routes:
        stops = []
        for s in r.stops:
            risk = None
            if s.risk:
                risk = {
                    "p_late": s.risk.p_late,
                    "reasons": s.risk.reasons,
                    "triage": getattr(s.risk, "triage", "monitor"),
                }
            stops.append(
                {
                    **{
                        k: getattr(s, k)
                        for k in (
                            "order_id",
                            "seq",
                            "eta_min",
                            "tw_start",
                            "tw_end",
                            "late",
                            "breach",
                            "priority",
                            "demand",
                            "lat",
                            "lon",
                            "zone",
                            "customer",
                            "address",
                            "sku",
                            "cod_inr",
                            "phone",
                            "zone_name",
                        )
                    },
                    "risk": risk,
                }
            )
        routes.append(
            {
                "vehicle_id": r.vehicle_id,
                "load": r.load,
                "capacity": r.capacity,
                "polyline": [list(p) for p in r.polyline],
                "stops": stops,
                "shift_start": r.shift_start,
                "shift_end": r.shift_end,
                "capacity_breach": r.capacity_breach,
                "driver": r.driver,
                "plate": r.plate,
                "phone": r.phone,
                "rating": r.rating,
                "road_source": r.road_source,
            }
        )
    return SolutionOut(
        scenario_id=solution.scenario_id,
        mode=solution.mode,
        feasible=solution.feasible,
        partial=solution.partial,
        metrics=solution.metrics.__dict__,
        routes=routes,
        unassigned=[u.__dict__ for u in solution.unassigned],
        constraint_log=[c.__dict__ for c in solution.constraint_log],
        travel_source=solution.travel_source,
        weather=WEATHER,
    )
