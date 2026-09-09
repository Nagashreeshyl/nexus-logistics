"""Auth dependencies: verify Firebase ID tokens. roles[] authorize; activeRole is UX-only."""

from __future__ import annotations

from typing import Any, Callable

from fastapi import Depends, Header, HTTPException

from .firebase_app import (
    auth_mode,
    demo_profile_fallback,
    firebase_auth_ready,
    firebase_configured,
    init_firebase,
    load_user_profile_admin,
    load_user_profile_rest,
    verify_id_token,
)
from .ops_repo import OpsRepository


async def optional_bearer_user(
    authorization: str | None = Header(default=None),
) -> dict[str, Any] | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    if not firebase_auth_ready():
        raise HTTPException(
            status_code=503,
            detail="Firebase Auth verification unavailable — set FIREBASE_PROJECT_ID or Admin credentials",
        )
    token = authorization.split(" ", 1)[1].strip()
    try:
        claims = verify_id_token(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid auth token") from exc
    # Keep raw token for REST profile fallback when Admin SDK is absent.
    claims["_id_token"] = token
    claims["_auth_mode"] = auth_mode()
    return claims


async def require_authenticated_user(
    claims: dict[str, Any] | None = Depends(optional_bearer_user),
) -> dict[str, Any]:
    if not claims:
        raise HTTPException(status_code=401, detail="Authentication required")
    return claims


# Alias used by older routes
require_user = require_authenticated_user


def load_user_profile(uid: str, id_token: str | None = None, email: str | None = None) -> dict[str, Any] | None:
    if init_firebase():
        return load_user_profile_admin(uid)
    if id_token:
        try:
            profile = load_user_profile_rest(uid, id_token)
            if profile:
                return profile
        except Exception:
            # Fall through to demo fallback when REST is rate-limited / unavailable.
            pass
    return demo_profile_fallback(uid, email)


def require_roles(claims: dict[str, Any], *roles: str) -> dict[str, Any]:
    """Authorize using profile.roles[] — NEVER activeRole."""
    profile = load_user_profile(
        claims["uid"],
        id_token=claims.get("_id_token"),
        email=claims.get("email"),
    )
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
        if not firebase_configured():
            return
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
