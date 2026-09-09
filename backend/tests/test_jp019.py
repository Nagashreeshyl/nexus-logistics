"""JP-019 constraint and credibility tests — focused, judge-challenging cases."""

from __future__ import annotations

import os

# Prefer deterministic travel for CI/demo stability
os.environ.setdefault("JP019_TRAVEL", "haversine")

from fastapi.testclient import TestClient

from app.baseline import run_baseline
from app.compare import improvement_rows
from app.data_loader import load_scenario
from app.main import app
from app.optimizer import run_optimize
from app.risk import RiskModel, train_and_evaluate


client = TestClient(app)


def test_optimize_never_exceeds_capacity_scenario_a():
    s = load_scenario("a")
    sol = run_optimize(s, time_limit_s=5)
    for r in sol.routes:
        assert r.load <= r.capacity
        assert not r.capacity_breach
    assert sol.metrics.capacity_breaches == 0


def test_optimize_respects_time_windows_when_assigned():
    s = load_scenario("a")
    sol = run_optimize(s, time_limit_s=5)
    assert sol.metrics.tw_violations == 0
    for r in sol.routes:
        for stop in r.stops:
            assert stop.eta_min <= stop.tw_end
            assert not stop.breach


def test_criticals_protected_under_capacity_pressure():
    s = load_scenario("b")
    sol = run_optimize(s, time_limit_s=6)
    critical_ids = {o.order_id for o in s.orders if o.priority == "critical"}
    served = {st.order_id for r in sol.routes for st in r.stops}
    deferred_crit = critical_ids - served
    normals_deferred = [u for u in sol.unassigned if u.priority == "normal"]
    assert sol.metrics.criticals_served == len(critical_ids & served)
    # Day B design: defer normals rather than drop criticals when possible
    assert len(deferred_crit) == 0 or len(normals_deferred) == 0
    assert len(deferred_crit) == 0
    assert sol.partial
    assert sol.metrics.unassigned_count > 0
    assert len(sol.constraint_log) >= 1


def test_infeasible_returns_partial_not_crash():
    s = load_scenario("b")
    sol = run_optimize(s, time_limit_s=6)
    assert sol.routes is not None
    if sol.partial:
        assert sol.metrics.unassigned_count > 0
        assert len(sol.constraint_log) >= sol.metrics.unassigned_count
        assert all(c.reason for c in sol.constraint_log)


def test_baseline_deterministic():
    s = load_scenario("a")
    a = run_baseline(s)
    b = run_baseline(s)
    assert a.metrics.distance_km == b.metrics.distance_km
    assert a.metrics.late_count == b.metrics.late_count
    seq_a = [[st.order_id for st in r.stops] for r in a.routes]
    seq_b = [[st.order_id for st in r.stops] for r in b.routes]
    assert seq_a == seq_b


def test_optimizer_stable_under_fixed_config():
    s = load_scenario("a")
    a = run_optimize(s, time_limit_s=5)
    b = run_optimize(s, time_limit_s=5)
    assert a.metrics.capacity_breaches == 0
    assert b.metrics.capacity_breaches == 0
    # Accept small search variance: criticals and feasibility should match
    assert a.metrics.criticals_served == b.metrics.criticals_served
    assert a.metrics.tw_violations == b.metrics.tw_violations == 0


def test_comparison_same_scenario_metrics():
    s = load_scenario("a")
    base = run_baseline(s)
    opt = run_optimize(s, time_limit_s=5)
    rows = improvement_rows(base.metrics.__dict__, opt.metrics.__dict__)
    assert len(rows) >= 8
    assert rows[0]["key"] == "distance_km"
    assert "baseline" in rows[0] and "optimized" in rows[0]


def test_risk_probability_in_unit_interval():
    s = load_scenario("a")
    sol = run_optimize(s, time_limit_s=5)
    model = RiskModel()
    sol = model.attach(sol, s.orders, s.vehicles)
    for r in sol.routes:
        for st in r.stops:
            assert st.risk is not None
            assert 0.0 <= st.risk.p_late <= 1.0


def test_risk_train_eval_no_crash():
    meta = train_and_evaluate(persist=False)
    m = meta["metrics"]
    assert "accuracy" in m and "f1" in m and "roc_auc" in m
    assert "eta_slack" not in meta["features"]
    assert "eta_slack" in meta["excluded_features"]
    assert "pre_route_metrics" in meta
    assert set(meta["pre_route_features"]) == {"depot_km", "window_width", "demand", "zone_late_rate"}
    assert "load_pct" not in meta["pre_route_features"]
    assert "seq_index" not in meta["pre_route_features"]


def test_pre_route_triage_uses_dedicated_model():
    from app.data_loader import load_scenario

    s = load_scenario("a")
    model = RiskModel()
    assert model.pre_clf is not None
    scores = model.triage_map(s.orders, s.vehicles)
    assert len(scores) == len(s.orders)
    assert all(0.0 <= v <= 1.0 for v in scores.values())
    # Distinct orders should not all collapse to the old placeholder-driven constant
    assert len(set(round(v, 2) for v in scores.values())) >= 2


def test_api_health_and_solve():
    h = client.get("/api/health")
    assert h.status_code == 200
    assert h.json()["ok"] is True
    r = client.post("/api/solve", json={"scenario_id": "a", "mode": "optimize"})
    assert r.status_code == 200
    body = r.json()
    assert "metrics" in body
    assert body["metrics"]["capacity_breaches"] == 0


def test_snap_roads_preserves_matrix_travel_source():
    from app.metrics import snap_roads
    from app.data_loader import load_scenario
    from app.optimizer import run_optimize

    s = load_scenario("a")
    sol = run_optimize(s, time_limit_s=4)
    assert "haversine" in sol.travel_source
    snapped = snap_roads(sol)
    assert snapped.travel_source == sol.travel_source


def test_api_compare_and_winsheet():
    c = client.post("/api/compare?scenario_id=a")
    assert c.status_code == 200
    data = c.json()
    assert data["same_scenario"] is True
    assert "comparison" in data
    assert len(data["comparison"]) >= 8
    w = client.get("/api/winsheet?scenario_id=a")
    assert w.status_code == 200
    sheet = w.json()
    assert "synthetic" in sheet["data_used"].lower()
    assert sheet["limitations"]
    assert "risk_model" in sheet
    rm = client.get("/api/risk/metrics")
    assert rm.status_code == 200
    assert "metrics" in rm.json()


def test_ops_health_without_forcing_firebase():
    r = client.get("/api/ops/health")
    assert r.status_code == 200
    body = r.json()
    assert "firebase_configured" in body
    assert "message" in body


def test_ops_me_requires_auth():
    r = client.get("/api/ops/me")
    assert r.status_code == 401


def test_ops_admin_ping_requires_auth():
    r = client.get("/api/ops/admin/ping")
    assert r.status_code == 401


def test_ops_active_role_requires_auth():
    r = client.post("/api/ops/me/active-role", json={"role": "driver"})
    assert r.status_code == 401


def test_lab_synthetic_generates_varying_scenarios():
    a = client.post("/api/lab/synthetic?seed=111")
    assert a.status_code == 200
    pa = a.json()
    assert pa["scenario_id"] == "lab"
    assert pa["summary"]["orders"] >= 12
    assert pa["summary"]["vehicles"] >= 3
    assert all("lat" in o and "lon" in o and "demand" in o for o in pa["orders"])
    detail = client.get("/api/scenarios/lab")
    assert detail.status_code == 200
    assert len(detail.json()["orders"]) == pa["summary"]["orders"]

    b = client.post("/api/lab/synthetic?seed=222")
    assert b.status_code == 200
    pb = b.json()
    assert pb["scenario_id"] == "lab"
    assert pa["generation_id"] != pb["generation_id"]
    assert pa["summary"] != pb["summary"] or [o["order_id"] for o in pa["orders"]] != [
        o["order_id"] for o in pb["orders"]
    ]
    detail_b = client.get("/api/scenarios/lab")
    assert len(detail_b.json()["orders"]) == pb["summary"]["orders"]


def test_lab_run_real_optimizer():
    syn = client.post("/api/lab/synthetic?seed=42")
    assert syn.status_code == 200
    payload = syn.json()
    run = client.post(
        "/api/lab/run",
        json={
            "scenario_id": payload["scenario_id"],
            "orders": payload["orders"],
            "vehicles": payload["vehicles"],
        },
    )
    assert run.status_code == 200
    body = run.json()
    assert "baseline" in body and "optimize" in body
    assert "metrics" in body["optimize"]
    # Hard capacity on assigned routes (OR-Tools); allow deferred orders when partial
    for route in body["optimize"]["routes"]:
        assert route["load"] <= route["capacity"]
        assert route["capacity_breach"] is False
    # Reoptimize excluding one vehicle
    vid = payload["vehicles"][0]["vehicle_id"]
    re = client.post(
        "/api/lab/run",
        json={
            "scenario_id": payload["scenario_id"],
            "orders": payload["orders"],
            "vehicles": payload["vehicles"],
            "exclude_vehicle_ids": [vid],
        },
    )
    assert re.status_code == 200
    assert vid in re.json()["excluded_vehicles"]
