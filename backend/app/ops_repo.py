"""Firestore operational repository — single write path for real + synthetic data."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .firebase_app import default_org_id, get_firestore, init_firebase


def _now() -> datetime:
    return datetime.now(timezone.utc)


def require_db():
    if not init_firebase():
        raise RuntimeError("Firebase not configured")
    return get_firestore()


class OpsRepository:
    def __init__(self, organization_id: str | None = None) -> None:
        self.org_id = organization_id or default_org_id()

    def audit(
        self,
        *,
        actor_id: str,
        actor_email: str,
        action: str,
        entity_type: str,
        entity_id: str,
        metadata: dict[str, Any] | None = None,
    ) -> str:
        db = require_db()
        ref = db.collection("auditLogs").document()
        ref.set(
            {
                "organizationId": self.org_id,
                "actorId": actor_id,
                "actorEmail": actor_email,
                "action": action,
                "entityType": entity_type,
                "entityId": entity_id,
                "metadata": metadata or {},
                "timestamp": _now(),
            }
        )
        return ref.id

    def create_entity(self, collection: str, data: dict[str, Any], doc_id: str | None = None) -> str:
        db = require_db()
        payload = {
            **data,
            "organizationId": self.org_id,
            "createdAt": data.get("createdAt") or _now(),
            "updatedAt": _now(),
        }
        if doc_id:
            db.collection(collection).document(doc_id).set(payload, merge=True)
            return doc_id
        ref = db.collection(collection).document()
        ref.set(payload)
        return ref.id

    def update_entity(self, collection: str, doc_id: str, patch: dict[str, Any]) -> None:
        db = require_db()
        db.collection(collection).document(doc_id).set({**patch, "updatedAt": _now()}, merge=True)

    def get_entity(self, collection: str, doc_id: str) -> dict[str, Any] | None:
        db = require_db()
        snap = db.collection(collection).document(doc_id).get()
        if not snap.exists:
            return None
        out = snap.to_dict() or {}
        out["id"] = snap.id
        return out

    def list_org(self, collection: str, limit: int = 200) -> list[dict[str, Any]]:
        db = require_db()
        q = (
            db.collection(collection)
            .where("organizationId", "==", self.org_id)
            .limit(limit)
            .stream()
        )
        rows: list[dict[str, Any]] = []
        for snap in q:
            row = snap.to_dict() or {}
            row["id"] = snap.id
            rows.append(row)
        return rows

    def count_org(self, collection: str) -> int:
        return len(self.list_org(collection, limit=500))
