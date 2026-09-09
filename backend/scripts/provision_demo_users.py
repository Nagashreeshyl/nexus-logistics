"""Provision demo multi-role Firestore user docs after Auth accounts exist.

Does NOT create passwords. Create Email/Password users in Firebase Console first.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Load .env if present (simple parser; python-dotenv optional)
env_path = ROOT.parent / ".env"
if env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

from app.firebase_app import (  # noqa: E402
    all_roles,
    default_org_id,
    default_org_name,
    demo_emails,
    get_firestore,
    init_firebase,
)


def main() -> int:
    if not init_firebase():
        print("ERROR: Firebase Admin not configured. See docs/FIREBASE_SETUP.md")
        return 1

    from firebase_admin import auth

    db = get_firestore()
    org_id = default_org_id()
    now = datetime.now(timezone.utc)

    db.collection("organizations").document(org_id).set(
        {
            "name": default_org_name(),
            "status": "active",
            "synthetic": True,
            "createdAt": now,
            "updatedAt": now,
        },
        merge=True,
    )

    roles = all_roles()
    ok = 0
    missing: list[str] = []
    for email in demo_emails():
        try:
            user = auth.get_user_by_email(email)
        except Exception:
            missing.append(email)
            continue
        db.collection("users").document(user.uid).set(
            {
                "email": email,
                "displayName": email.split("@")[0],
                "roles": roles,
                "activeRole": "dispatcher",
                "driverId": None,
                "organizationId": org_id,
                "status": "active",
                "demoMultiRole": True,
                "createdAt": now,
                "updatedAt": now,
            },
            merge=True,
        )
        print(f"provisioned {email} -> {user.uid} roles={roles}")
        ok += 1

    if missing:
        print("Auth accounts not found (create them in Firebase Console first):")
        for e in missing:
            print(f"  - {e}")
    print(f"Done. provisioned={ok} missing={len(missing)}")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
