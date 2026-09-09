from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .auth_deps import load_user_profile, require_roles, require_user
from .firebase_app import firebase_configured, init_firebase
from .ops_repo import OpsRepository

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
def me(claims: dict = Depends(require_user)) -> dict:
    profile = load_user_profile(claims["uid"])
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found — run provision_demo_users.py")
    return {"claims": {"uid": claims["uid"], "email": claims.get("email")}, "profile": profile}


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
    repo = OpsRepository(profile.get("organizationId"))
    return {"items": repo.list_org(collection)}
