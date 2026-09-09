"""Auth dependencies: verify Firebase ID tokens. roles[] authorize; activeRole is UX-only."""

from __future__ import annotations

from typing import Any, Callable

from fastapi import Depends, Header, HTTPException

from .firebase_app import firebase_configured, get_firestore, init_firebase, verify_id_token
from .ops_repo import OpsRepository


async def optional_bearer_user(
    authorization: str | None = Header(default=None),
) -> dict[str, Any] | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    if not firebase_configured():
        raise HTTPException(status_code=503, detail="Firebase Admin not configured")
    if not init_firebase():
        raise HTTPException(status_code=503, detail="Firebase Admin failed to initialize")
    token = authorization.split(" ", 1)[1].strip()
    try:
        return verify_id_token(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid auth token") from exc


async def require_authenticated_user(
    claims: dict[str, Any] | None = Depends(optional_bearer_user),
) -> dict[str, Any]:
    if not claims:
        raise HTTPException(status_code=401, detail="Authentication required")
    return claims


# Alias used by older routes
require_user = require_authenticated_user


def load_user_profile(uid: str) -> dict[str, Any] | None:
    if not init_firebase():
        return None
    snap = get_firestore().collection("users").document(uid).get()
    if not snap.exists:
        return None
    data = snap.to_dict() or {}
    data["uid"] = uid
    return data


def require_roles(claims: dict[str, Any], *roles: str) -> dict[str, Any]:
    """Authorize using profile.roles[] — NEVER activeRole."""
    profile = load_user_profile(claims["uid"])
    if not profile:
        raise HTTPException(status_code=403, detail="User profile missing — run provision_demo_users.py")
    have = set(profile.get("roles") or [])
    if not have.intersection(roles):
        raise HTTPException(status_code=403, detail="Insufficient role")
    return profile


def require_role(*roles: str) -> Callable:
    async def _dep(claims: dict[str, Any] = Depends(require_authenticated_user)) -> dict[str, Any]:
        return require_roles(claims, *roles)

    return _dep


def record_auth_audit(
    *,
    actor_id: str,
    actor_email: str,
    action: str,
    organization_id: str,
    metadata: dict[str, Any] | None = None,
) -> None:
    try:
        OpsRepository(organization_id).audit(
            actor_id=actor_id,
            actor_email=actor_email,
            action=action,
            entity_type="user",
            entity_id=actor_id,
            metadata=metadata or {},
        )
    except Exception:
        # Audit must not break auth flows when Firebase partially configured.
        pass
