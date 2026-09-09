"""One-shot: create demo Auth users + provision Firestore roles/org.

Uses Identity Toolkit (web API key) + temporary Security Rules bootstrap.
Does NOT commit passwords. Writes credentials only to secrets/ (gitignored).

Usage:
  ../.venv/bin/python scripts/bootstrap_demo_access.py
"""

from __future__ import annotations

import json
import os
import secrets
import string
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
SECRETS = REPO / "secrets"
CRED_FILE = SECRETS / "demo-credentials.local.json"

DEMO_EMAILS = [
    "nagashreeshyl@gmail.com",
    "skandachandrashekar335@gmail.com",
    "nivethams07@gmail.com",
    "ankithalokesh0@gmail.com",
]
ROLES = ["admin", "dispatcher", "driver", "analyst"]
ORG_ID = "nexus-demo"
ORG_NAME = "Nexus Logistics Demo"


def load_env() -> None:
    for path in (REPO / ".env", REPO / "frontend" / ".env.local"):
        if not path.exists():
            continue
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def api_key() -> str:
    key = os.environ.get("VITE_FIREBASE_API_KEY") or os.environ.get("FIREBASE_API_KEY")
    if not key:
        raise SystemExit("Missing VITE_FIREBASE_API_KEY in frontend/.env.local")
    return key


def project_id() -> str:
    return os.environ.get("VITE_FIREBASE_PROJECT_ID") or os.environ.get("FIREBASE_PROJECT_ID") or "nexus-2a448"


def gen_password() -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return "Nx!" + "".join(secrets.choice(alphabet) for _ in range(16))


def http_json(url: str, payload: dict, headers: dict | None = None) -> dict:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", **(headers or {})},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            err = json.loads(body)
        except Exception:
            err = {"error": {"message": body}}
        raise RuntimeError(err.get("error", {}).get("message", body)) from e


def sign_up(email: str, password: str) -> dict:
    return http_json(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={api_key()}",
        {"email": email, "password": password, "returnSecureToken": True},
    )


def sign_in(email: str, password: str) -> dict:
    return http_json(
        f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={api_key()}",
        {"email": email, "password": password, "returnSecureToken": True},
    )


def firestore_patch(id_token: str, doc_path: str, fields: dict) -> None:
    """Write via Firestore REST (rules must allow this during bootstrap)."""
    url = (
        f"https://firestore.googleapis.com/v1/projects/{project_id()}"
        f"/databases/(default)/documents/{doc_path}"
    )
    body = {"fields": fields}
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        url,
        data=data,
        method="PATCH",
        headers={
            "Authorization": f"Bearer {id_token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            resp.read()
    except urllib.error.HTTPError as e:
        raise RuntimeError(e.read().decode()) from e


def fs_string(v: str) -> dict:
    return {"stringValue": v}


def fs_null() -> dict:
    return {"nullValue": None}


def fs_bool(v: bool) -> dict:
    return {"booleanValue": v}


def fs_array_strings(vals: list[str]) -> dict:
    return {"arrayValue": {"values": [fs_string(x) for x in vals]}}


def fs_timestamp(dt: datetime) -> dict:
    return {"timestampValue": dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")}


def ensure_auth_user(email: str, existing: dict[str, dict]) -> tuple[str, str, str]:
    """Return (uid, password, id_token)."""
    if email in existing and existing[email].get("password"):
        password = existing[email]["password"]
        try:
            sess = sign_in(email, password)
            return sess["localId"], password, sess["idToken"]
        except RuntimeError:
            pass

    password = gen_password()
    try:
        sess = sign_up(email, password)
        return sess["localId"], password, sess["idToken"]
    except RuntimeError as exc:
        msg = str(exc)
        if "EMAIL_EXISTS" in msg:
            raise RuntimeError(
                f"{email} already exists in Auth but we don't have its password. "
                f"Delete it in Firebase Console Auth → Users, then re-run this script."
            ) from exc
        if "OPERATION_NOT_ALLOWED" in msg:
            raise RuntimeError(
                "Email/Password sign-in is disabled. Enable it in Firebase Console → "
                "Authentication → Sign-in method → Email/Password."
            ) from exc
        raise


def main() -> int:
    load_env()
    SECRETS.mkdir(parents=True, exist_ok=True)
    existing: dict[str, dict] = {}
    if CRED_FILE.exists():
        existing = json.loads(CRED_FILE.read_text()).get("users", {})

    now = datetime.now(timezone.utc)
    out_users: dict[str, dict] = {}
    first_token: str | None = None

    print(f"Project: {project_id()}")
    print("Creating / signing in demo Auth users…")

    for email in DEMO_EMAILS:
        uid, password, token = ensure_auth_user(email, existing)
        out_users[email] = {"uid": uid, "password": password, "email": email}
        if first_token is None:
            first_token = token
        print(f"  OK auth {email} -> {uid}")

        # Provision user profile (requires bootstrap rules)
        firestore_patch(
            token,
            f"users/{uid}",
            {
                "uid": fs_string(uid),
                "email": fs_string(email),
                "displayName": fs_string(email.split("@")[0]),
                "roles": fs_array_strings(ROLES),
                "activeRole": fs_string("dispatcher"),
                "driverId": fs_null(),
                "organizationId": fs_string(ORG_ID),
                "status": fs_string("active"),
                "demoMultiRole": fs_bool(True),
                "createdAt": fs_timestamp(now),
                "updatedAt": fs_timestamp(now),
            },
        )
        print(f"  OK roles {email} -> {ROLES}")
        time.sleep(0.3)

    assert first_token
    firestore_patch(
        first_token,
        f"organizations/{ORG_ID}",
        {
            "name": fs_string(ORG_NAME),
            "status": fs_string("active"),
            "synthetic": fs_bool(True),
            "createdAt": fs_timestamp(now),
            "updatedAt": fs_timestamp(now),
        },
    )
    print(f"  OK organization {ORG_ID}")

    payload = {
        "projectId": project_id(),
        "createdAt": now.isoformat(),
        "note": "LOCAL ONLY — gitignored. Share passwords out-of-band; never commit.",
        "users": out_users,
        "roles": ROLES,
        "organizationId": ORG_ID,
    }
    CRED_FILE.write_text(json.dumps(payload, indent=2) + "\n")
    os.chmod(CRED_FILE, 0o600)
    print(f"\nCredentials written to {CRED_FILE} (gitignored)")
    print("Each user has roles: admin, dispatcher, driver, analyst")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
