# RBAC — Nexus Logistics V2

## Roles

| Role | Scope |
|------|--------|
| `admin` | Full organization management |
| `dispatcher` | Operations, assignments, optimization, exceptions |
| `driver` | Own profile / assigned routes / deliveries |
| `analyst` | Read-only analytics |

Defined in:

- `frontend/src/lib/roles.ts`
- `backend/app/ops_types.py`

## Authorization vs presentation

| Field | Purpose |
|-------|---------|
| `roles[]` | **Authorization** (Security Rules + FastAPI) |
| `activeRole` | **UX only** (which dashboard shell to show) |

A user with `roles: [admin, dispatcher, driver, analyst]` and `activeRole: driver` may still call admin APIs if they present a valid ID token — because `admin` is in `roles[]`. The UI simply navigates to the Driver shell when switching.

## Enforcement

1. **Firestore Security Rules** (`firestore.rules`) — org isolation, role checks, no client role escalation.
2. **FastAPI** — `require_authenticated_user`, `require_role(...)`, `require_roles(...)` verify Firebase ID tokens and load `users/{uid}.roles`.
3. **Frontend** — route guards use `canAccess(role)` against `roles[]`. Hiding nav is UX only.

## Demo users

Configured via `NEXUS_DEMO_EMAILS` (see `.env.example`). Provision with:

```bash
cd backend && ../.venv/bin/python scripts/provision_demo_users.py
```

Passwords are never stored in the repo.

## Realtime (V2.4)

Operational dashboards subscribe with Firestore `onSnapshot` (see `docs/REALTIME_ARCHITECTURE.md`).  
Authorization for listener results still comes from Security Rules + `roles[]`, never `activeRole`.
