"""Firebase Admin initialization for FastAPI (Auth + Firestore)."""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Any

_initialized = False


def firebase_configured() -> bool:
    if os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON"):
        return True
    cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")
    if cred_path and Path(cred_path).expanduser().exists():
        return True
    # Emulator mode needs project id only
    if os.environ.get("FIRESTORE_EMULATOR_HOST") and os.environ.get("FIREBASE_PROJECT_ID"):
        return True
    return False


def init_firebase() -> bool:
    """Initialize Admin SDK once. Returns True if ready."""
    global _initialized
    if _initialized:
        return True
    if not firebase_configured():
        return False

    import firebase_admin
    from firebase_admin import credentials

    if firebase_admin._apps:  # type: ignore[attr-defined]
        _initialized = True
        return True

    project_id = os.environ.get("FIREBASE_PROJECT_ID") or None
    raw = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    if raw:
        info = json.loads(raw)
        cred = credentials.Certificate(info)
        firebase_admin.initialize_app(cred, {"projectId": project_id or info.get("project_id")})
    else:
        path = Path(os.environ["GOOGLE_APPLICATION_CREDENTIALS"]).expanduser()
        if path.exists():
            cred = credentials.Certificate(str(path))
            firebase_admin.initialize_app(cred, {"projectId": project_id} if project_id else None)
        else:
            # Emulator / ADC
            firebase_admin.initialize_app(options={"projectId": project_id} if project_id else None)

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


def verify_id_token(id_token: str) -> dict[str, Any]:
    if not init_firebase():
        raise RuntimeError("Firebase Admin not configured")
    from firebase_admin import auth

    return auth.verify_id_token(id_token)


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
