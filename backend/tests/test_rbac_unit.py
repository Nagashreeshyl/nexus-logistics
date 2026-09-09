"""Unit tests for RBAC semantics (no Firebase credentials required)."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.auth_deps import require_roles
from app.ops_types import ALL_ROLES


def test_all_roles_exact():
    assert ALL_ROLES == ("admin", "dispatcher", "driver", "analyst")


def test_active_role_does_not_authorize():
    profile = {
        "roles": ["admin", "dispatcher", "driver", "analyst"],
        "activeRole": "driver",
    }
    have = set(profile["roles"])
    assert have.intersection({"admin"})
    assert profile["activeRole"] == "driver"
    # Gate uses roles[], not activeRole
    assert "admin" in have
    assert profile["activeRole"] != "admin"


def test_missing_role_denied_semantics():
    profile = {"roles": ["driver"], "activeRole": "admin"}  # spoofed UX
    have = set(profile["roles"])
    assert not have.intersection({"admin"})


def test_require_roles_uses_roles_not_active(monkeypatch):
    claims = {"uid": "u1", "email": "a@b.com"}
    profile = {
        "uid": "u1",
        "roles": ["driver", "analyst"],
        "activeRole": "admin",
        "organizationId": "nexus-demo",
    }
    monkeypatch.setattr(
        "app.auth_deps.load_user_profile",
        lambda uid, id_token=None, email=None: profile,
    )
    with pytest.raises(HTTPException) as exc:
        require_roles(claims, "admin")
    assert exc.value.status_code == 403
    # Same user can access analyst via roles[]
    out = require_roles(claims, "analyst")
    assert out["roles"] == ["driver", "analyst"]


def test_require_roles_missing_profile(monkeypatch):
    monkeypatch.setattr(
        "app.auth_deps.load_user_profile",
        lambda uid, id_token=None, email=None: None,
    )
    with pytest.raises(HTTPException) as exc:
        require_roles({"uid": "missing"}, "admin")
    assert exc.value.status_code == 403


def test_multi_role_satisfies_any_authorized(monkeypatch):
    claims = {"uid": "u2"}
    profile = {
        "roles": ["admin", "dispatcher", "driver", "analyst"],
        "activeRole": "driver",
    }
    monkeypatch.setattr(
        "app.auth_deps.load_user_profile",
        lambda uid, id_token=None, email=None: profile,
    )
    assert require_roles(claims, "admin")["activeRole"] == "driver"
    assert require_roles(claims, "dispatcher") is not None
