from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .auth_deps import (
    load_user_profile,
    record_auth_audit,
    require_authenticated_user,
    require_role,
    require_roles,
    require_user,
)
from .firebase_app import auth_mode, firebase_auth_ready, firebase_configured, init_firebase
from .ops_repo import OpsRepository
from .ops_types import ALL_ROLES

router = APIRouter(prefix="/api/ops", tags=["ops"])


class HealthOpsOut(BaseModel):
    firebase_configured: bool
    firebase_initialized: bool
    firebase_auth_ready: bool
    auth_mode: str
    message: str


@router.get("/health", response_model=HealthOpsOut)
def ops_health() -> HealthOpsOut:
    configured = firebase_configured()
    initialized = init_firebase() if configured else False
    ready = firebase_auth_ready()
    mode = auth_mode()
    if configured and initialized:
        msg = "Firebase Admin ready"
    elif mode == "jwt_fallback":
        msg = "JWT fallback ready (no Admin SA) — ID tokens verified via Google certs"
    else:
        msg = "Configure FIREBASE_PROJECT_ID and/or Admin credentials — see docs/FIREBASE_SETUP.md"
    return HealthOpsOut(
        firebase_configured=configured,
        firebase_initialized=initialized,
        firebase_auth_ready=ready,
        auth_mode=mode,
        message=msg,
    )


@router.get("/me")
def me(claims: dict = Depends(require_authenticated_user)) -> dict:
    profile = load_user_profile(
        claims["uid"],
        id_token=claims.get("_id_token"),
        email=claims.get("email"),
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found — run provision_demo_users.py")
    return {
        "claims": {"uid": claims["uid"], "email": claims.get("email")},
        "profile": profile,
        "auth_mode": claims.get("_auth_mode"),
        "authorization_note": "Endpoint access uses roles[]; activeRole is presentation-only.",
    }


class ActiveRoleBody(BaseModel):
    role: str


@router.post("/me/active-role")
def set_active_role(body: ActiveRoleBody, claims: dict = Depends(require_authenticated_user)) -> dict:
    """UX switch only — does not grant permissions."""
    if body.role not in ALL_ROLES:
        raise HTTPException(status_code=400, detail="Unknown role")
    profile = load_user_profile(claims["uid"])
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    authorized = set(profile.get("roles") or [])
    if body.role not in authorized:
        raise HTTPException(status_code=403, detail="Cannot activate unauthorized role")
    org = str(profile.get("organizationId") or "nexus-demo")
    OpsRepository(org).update_entity(
        "users",
        claims["uid"],
        {"activeRole": body.role},
    )
    record_auth_audit(
        actor_id=claims["uid"],
        actor_email=str(claims.get("email") or ""),
        action="role_switched",
        organization_id=org,
        metadata={"activeRole": body.role, "authorizedRoles": list(authorized)},
    )
    return {"ok": True, "activeRole": body.role, "roles": list(authorized)}


@router.get("/admin/ping")
def admin_ping(_profile: dict = Depends(require_role("admin"))) -> dict:
    """Ignores activeRole — any user with admin in roles[] may call this."""
    return {"ok": True, "gate": "admin"}


@router.get("/dispatcher/ping")
def dispatcher_ping(_profile: dict = Depends(require_role("dispatcher", "admin"))) -> dict:
    return {"ok": True, "gate": "dispatcher"}


class EntityCreate(BaseModel):
    collection: str = Field(..., pattern="^(drivers|vehicles|customers|orders)$")
    data: dict
    doc_id: str | None = None


@router.post("/entities")
def create_entity(body: EntityCreate, claims: dict = Depends(require_user)) -> dict:
    profile = require_roles(claims, "admin", "dispatcher")
    repo = OpsRepository(profile.get("organizationId"))
    entity_id = repo.create_entity(body.collection, {**body.data, "createdBy": claims["uid"]})
    repo.audit(
        actor_id=claims["uid"],
        actor_email=str(claims.get("email") or ""),
        action="create",
        entity_type=body.collection,
        entity_id=entity_id,
        metadata={"synthetic": bool(body.data.get("synthetic"))},
    )
    return {"id": entity_id}


@router.get("/entities/{collection}")
def list_entities(collection: str, claims: dict = Depends(require_user)) -> dict:
    profile = require_roles(claims, "admin", "dispatcher", "analyst", "driver")
    allowed = {"drivers", "vehicles", "customers", "orders", "routes", "exceptions", "auditLogs", "optimizationRuns"}
    if collection not in allowed:
        raise HTTPException(status_code=400, detail="unknown collection")
    if collection == "auditLogs":
        require_roles(claims, "admin")
    repo = OpsRepository(profile.get("organizationId"))
    return {"items": repo.list_org(collection)}


class LiveOptimizeBody(BaseModel):
    organization_id: str
    orders: list[dict] = Field(default_factory=list)
    vehicles: list[dict] = Field(default_factory=list)
    depot_lat: float = 12.9716
    depot_lon: float = 77.5946


def _solution_dict(solution) -> dict:
    from .main import _to_out

    return _to_out(solution).model_dump()


@router.post("/optimize-live")
def optimize_live(body: LiveOptimizeBody, claims: dict = Depends(require_user)) -> dict:
    """
    Run existing OR-Tools + ML on live operational payloads (from Firestore).
    Hard constraints stay in OR-Tools; ML is advisory triage/risk only.
    """
    profile = require_roles(claims, "admin", "dispatcher")
    org = str(profile.get("organizationId") or "")
    if body.organization_id != org:
        raise HTTPException(status_code=403, detail="organization mismatch")

    from .baseline import run_baseline
    from .live_scenario import scenario_from_live
    from .main import risk_model
    from .metrics import snap_roads
    from .optimizer import run_optimize

    try:
        scenario = scenario_from_live(
            scenario_id=f"live-{org}",
            orders=body.orders,
            vehicles=body.vehicles,
            depot_lat=body.depot_lat,
            depot_lon=body.depot_lon,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not scenario.orders:
        raise HTTPException(status_code=400, detail="No open orders to optimize")

    baseline = snap_roads(risk_model.attach(run_baseline(scenario), scenario.orders, scenario.vehicles))
    triage = risk_model.triage_map(scenario.orders, scenario.vehicles)
    optimized = snap_roads(
        risk_model.attach(run_optimize(scenario, triage_scores=triage), scenario.orders, scenario.vehicles)
    )

    explanations: list[str] = []
    for route in optimized.routes:
        if not route.stops:
            continue
        explanations.append(
            f"Vehicle {route.vehicle_id} selected for {len(route.stops)} stop(s); "
            f"load {route.load}/{route.capacity} within hard capacity."
        )
        for stop in route.stops[:3]:
            reasons = (stop.risk.reasons if stop.risk else []) or []
            if reasons:
                explanations.append(f"Order {stop.order_id} risk note: {reasons[0]}")
    for u in optimized.unassigned:
        explanations.append(
            f"Order {u.order_id} deferred: no feasible vehicle/window/capacity assignment under hard constraints."
        )

    bm = baseline.metrics
    om = optimized.metrics
    comparison = [
        {
            "key": "distance_km",
            "metric": "Distance (km)",
            "baseline": bm.distance_km,
            "optimized": om.distance_km,
            "delta": round(om.distance_km - bm.distance_km, 2),
        },
        {
            "key": "late_count",
            "metric": "Late deliveries",
            "baseline": bm.late_count,
            "optimized": om.late_count,
            "delta": om.late_count - bm.late_count,
        },
        {
            "key": "vehicles_used",
            "metric": "Vehicles used",
            "baseline": bm.vehicles_used,
            "optimized": om.vehicles_used,
            "delta": om.vehicles_used - bm.vehicles_used,
        },
        {
            "key": "unassigned_count",
            "metric": "Deferred orders",
            "baseline": bm.unassigned_count,
            "optimized": om.unassigned_count,
            "delta": om.unassigned_count - bm.unassigned_count,
        },
        {
            "key": "capacity_utilization",
            "metric": "Avg utilization",
            "baseline": bm.capacity_utilization,
            "optimized": om.capacity_utilization,
            "delta": round(om.capacity_utilization - bm.capacity_utilization, 3),
        },
    ]

    return {
        "organization_id": org,
        "feasible": optimized.feasible,
        "partial": optimized.partial,
        "baseline": _solution_dict(baseline),
        "optimize": _solution_dict(optimized),
        "comparison": comparison,
        "explanations": explanations,
        "triage_note": "ML triage may prefer risky normals when capacity allows; it never relaxes hard constraints.",
        "ml_metrics": risk_model.evaluation(),
    }
