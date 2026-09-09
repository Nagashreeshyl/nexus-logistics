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
from .firebase_app import firebase_configured, init_firebase
from .ops_repo import OpsRepository
from .ops_types import ALL_ROLES

router = APIRouter(prefix="/api/ops", tags=["ops"])


class HealthOpsOut(BaseModel):
    firebase_configured: bool
    firebase_initialized: bool
    message: str


@router.get("/health", response_model=HealthOpsOut)
def ops_health() -> HealthOpsOut:
    configured = firebase_configured()
    initialized = init_firebase() if configured else False
    msg = "Firebase Admin ready" if initialized else "Configure credentials — see docs/FIREBASE_SETUP.md"
    return HealthOpsOut(
        firebase_configured=configured,
        firebase_initialized=initialized,
        message=msg,
    )


@router.get("/me")
def me(claims: dict = Depends(require_authenticated_user)) -> dict:
    profile = load_user_profile(claims["uid"])
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found — run provision_demo_users.py")
    return {
        "claims": {"uid": claims["uid"], "email": claims.get("email")},
        "profile": profile,
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
    allowed = {"drivers", "vehicles", "customers", "orders", "routes", "exceptions", "auditLogs"}
    if collection not in allowed:
        raise HTTPException(status_code=400, detail="unknown collection")
    if collection == "auditLogs":
        require_roles(claims, "admin")
    repo = OpsRepository(profile.get("organizationId"))
    return {"items": repo.list_org(collection)}
