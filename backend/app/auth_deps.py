"""Auth dependencies: verify Firebase ID tokens for protected FastAPI routes."""

from __future__ import annotations

from typing import Any

from fastapi import Depends, Header, HTTPException

from .firebase_app import firebase_configured, get_firestore, init_firebase, verify_id_token


async def optional_bearer_user(
    authorization: str | None = Header(default=None),
) -> dict[str, Any] | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    if not firebase_configured() or not init_firebase():
        return None
    token = authorization.split(" ", 1)[1].strip()
    try:
        claims = verify_id_token(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid auth token") from exc
    return claims


async def require_user(claims: dict[str, Any] | None = Depends(optional_bearer_user)) -> dict[str, Any]:
    if not claims:
        raise HTTPException(status_code=401, detail="Authentication required")
    return claims


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
    profile = load_user_profile(claims["uid"])
    if not profile:
        raise HTTPException(status_code=403, detail="User profile missing")
    have = set(profile.get("roles") or [])
    if not have.intersection(roles):
        raise HTTPException(status_code=403, detail="Insufficient role")
    return profile
