"""Firebase Admin initialization for FastAPI (Auth + Firestore).

Auth modes:
1. Admin SDK (preferred) when GOOGLE_APPLICATION_CREDENTIALS / FIREBASE_SERVICE_ACCOUNT_JSON is set
2. JWT fallback: verify Firebase ID tokens via Google public certs when FIREBASE_PROJECT_ID is set
   (no service-account file required for token verification + user-scoped Firestore REST reads)
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from functools import lru_cache
from pathlib import Path
from typing import Any

_initialized = False
_ENV_LOADED = False


def _load_repo_env() -> None:
    """Best-effort load of repo-root /.env without python-dotenv."""
    global _ENV_LOADED
    if _ENV_LOADED:
        return
    _ENV_LOADED = True
    # backend/app/firebase_app.py → repo root
    root = Path(__file__).resolve().parents[2]
    env_path = root / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        text = line.strip()
        if not text or text.startswith("#") or "=" not in text:
            continue
        key, value = text.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_repo_env()


def project_id() -> str | None:
    return os.environ.get("FIREBASE_PROJECT_ID") or None


def firebase_admin_ready() -> bool:
    """True when Admin SDK credentials are present."""
    if os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON"):
        return True
    cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")
    if cred_path and Path(cred_path).expanduser().exists():
        return True
    if os.environ.get("FIRESTORE_EMULATOR_HOST") and project_id():
        return True
    return False


def firebase_configured() -> bool:
    """Backward-compatible: Admin credentials present."""
    return firebase_admin_ready()


def firebase_auth_ready() -> bool:
    """True when ID tokens can be verified (Admin or JWT fallback)."""
    return firebase_admin_ready() or bool(project_id())


def auth_mode() -> str:
    if firebase_admin_ready():
        return "admin_sdk"
    if project_id():
        return "jwt_fallback"
    return "none"


def init_firebase() -> bool:
    """Initialize Admin SDK once. Returns True if Admin is ready."""
    global _initialized
    if _initialized:
        return True
    if not firebase_admin_ready():
        return False

    import firebase_admin
    from firebase_admin import credentials

    if firebase_admin._apps:  # type: ignore[attr-defined]
        _initialized = True
        return True

    pid = project_id()
    raw = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    if raw:
        info = json.loads(raw)
        cred = credentials.Certificate(info)
        firebase_admin.initialize_app(cred, {"projectId": pid or info.get("project_id")})
    else:
        cred_env = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")
        path = Path(cred_env).expanduser() if cred_env else None
        if path and path.exists():
            cred = credentials.Certificate(str(path))
            firebase_admin.initialize_app(cred, {"projectId": pid} if pid else None)
        else:
            firebase_admin.initialize_app(options={"projectId": pid} if pid else None)

    _initialized = True
    return True


def get_firestore():
    if not init_firebase():
        raise RuntimeError(
            "Firebase Admin not configured. Set GOOGLE_APPLICATION_CREDENTIALS "
            "or FIREBASE_SERVICE_ACCOUNT_JSON (see docs/FIREBASE_SETUP.md)."
        )
    from firebase_admin import firestore

    return firestore.client()


def verify_id_token(id_token_str: str) -> dict[str, Any]:
    """Verify Firebase ID token. Prefer Admin SDK; fall back to Google public certs."""
    if init_firebase():
        from firebase_admin import auth

        return auth.verify_id_token(id_token_str)

    pid = project_id()
    if not pid:
        raise RuntimeError(
            "Firebase Admin not configured and FIREBASE_PROJECT_ID missing — "
            "cannot verify ID tokens (see docs/FIREBASE_SETUP.md)."
        )
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token as google_id_token

    claims = google_id_token.verify_firebase_token(
        id_token_str,
        google_requests.Request(),
        audience=pid,
    )
    # Normalize to Admin-like shape
    if "uid" not in claims and "sub" in claims:
        claims = {**claims, "uid": claims["sub"]}
    return claims


def load_user_profile_admin(uid: str) -> dict[str, Any] | None:
    if not init_firebase():
        return None
    snap = get_firestore().collection("users").document(uid).get()
    if not snap.exists:
        return None
    data = snap.to_dict() or {}
    data["uid"] = uid
    return data


def load_user_profile_rest(uid: str, bearer_token: str) -> dict[str, Any] | None:
    """Read users/{uid} with the caller's ID token (rules: self-read)."""
    import time

    pid = project_id()
    if not pid:
        return None
    url = (
        f"https://firestore.googleapis.com/v1/projects/{pid}/databases/(default)/documents/users/{uid}"
    )
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {bearer_token}"},
        method="GET",
    )
    last_err: Exception | None = None
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=12) as resp:
                payload = json.loads(resp.read().decode("utf-8"))
            fields = payload.get("fields") or {}
            data = _firestore_fields_to_dict(fields)
            data["uid"] = uid
            return data
        except urllib.error.HTTPError as exc:
            last_err = exc
            if exc.code in {403, 404}:
                return None
            if exc.code in {429, 503} and attempt < 3:
                time.sleep(1.2 * (attempt + 1))
                continue
            raise
    if last_err:
        raise last_err
    return None


def demo_profile_fallback(uid: str, email: str | None) -> dict[str, Any] | None:
    """
    Last-resort profile when Admin SA is absent and Firestore REST is unavailable.
    Only for provisioned demo emails. Still requires a verified Firebase ID token.
    """
    if not email:
        return None
    if email.strip().lower() not in {e.lower() for e in demo_emails()}:
        return None
    return {
        "uid": uid,
        "email": email,
        "displayName": email.split("@")[0],
        "roles": all_roles(),
        "activeRole": "dispatcher",
        "organizationId": default_org_id(),
        "status": "active",
        "driverId": None,
        "dataSource": "demo_fallback_profile",
    }


def _firestore_fields_to_dict(fields: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, raw in fields.items():
        if "stringValue" in raw:
            out[key] = raw["stringValue"]
        elif "integerValue" in raw:
            out[key] = int(raw["integerValue"])
        elif "doubleValue" in raw:
            out[key] = float(raw["doubleValue"])
        elif "booleanValue" in raw:
            out[key] = bool(raw["booleanValue"])
        elif "nullValue" in raw:
            out[key] = None
        elif "arrayValue" in raw:
            values = (raw["arrayValue"] or {}).get("values") or []
            out[key] = [
                v.get("stringValue")
                if "stringValue" in v
                else v.get("integerValue")
                if "integerValue" in v
                else None
                for v in values
            ]
        elif "mapValue" in raw:
            out[key] = _firestore_fields_to_dict((raw["mapValue"] or {}).get("fields") or {})
        else:
            out[key] = None
    return out


@lru_cache
def demo_emails() -> tuple[str, ...]:
    raw = os.environ.get(
        "NEXUS_DEMO_EMAILS",
        "nagashreeshyl@gmail.com,skandachandrashekar335@gmail.com,"
        "nivethams07@gmail.com,ankithalokesh0@gmail.com",
    )
    return tuple(e.strip().lower() for e in raw.split(",") if e.strip())


def default_org_id() -> str:
    return os.environ.get("NEXUS_ORG_ID", "nexus-demo")


def default_org_name() -> str:
    return os.environ.get("NEXUS_ORG_NAME", "Nexus Logistics Demo")


def all_roles() -> list[str]:
    return ["admin", "dispatcher", "driver", "analyst"]
