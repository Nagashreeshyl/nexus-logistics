# Security Model — Nexus Logistics V2

**Branch:** `v2`  
**Sources of truth:** `firestore.rules`, `backend/app/auth_deps.py`, `frontend/src/lib/roles.ts`, `docs/RBAC.md`

---

## 1. Principles

1. **Authenticate** with Firebase Auth (email/password).
2. **Authorize** with `users/{uid}.roles[]` only.
3. **`activeRole` is presentation** — workspace switcher / UX; never grants access.
4. **Organization isolation** via `organizationId` on operational documents.
5. **UI gates are not security** — Firestore rules + FastAPI must deny.

---

## 2. Roles

| Role | Intent |
|------|--------|
| `admin` | System control, elevated ops |
| `dispatcher` | Fleet, orders, optimize, exceptions, assign |
| `driver` | Own deliveries / route actions |
| `analyst` | Read-heavy analytics; no operational writes |

Demo accounts are often multi-role for hackathon switching. Production should use least privilege.

---

## 3. Client security (Firestore rules)

Highlights from `firestore.rules`:

- `inOrg(orgId)` — caller’s profile `organizationId` must match resource.
- `hasRole(role)` — membership in `roles[]`.
- Users cannot escalate: `roles`, `organizationId`, and `status` immutable on self-update (`noPrivilegeEscalation`).
- Drivers see own deliveries (`driverUserId == request.auth.uid`).
- Dispatchers manage ops creates/updates; analysts generally read.
- Synthetic deletes: admin, or dispatcher deleting `synthetic == true`.
- `auditLogs`: update/delete denied; **create currently allowed for any signed-in user** (known weakness).
- `notifications`: read/update own `userId` only.

---

## 4. Server security (FastAPI)

### Ops API (`/api/ops/*`)

- Bearer Firebase ID token required (except `/api/ops/health`).
- Token verify: Admin SDK if configured, else JWT fallback when `FIREBASE_PROJECT_ID` set.
- Profile load: Admin Firestore → REST with caller token → optional **demo profile fallback** for known demo emails under REST failure (demo-only).
- `require_roles(...)` checks `roles[]`, never `activeRole`.
- `POST /api/ops/optimize-live` requires admin/dispatcher and matching `organization_id`.

### Lab / V1 API (`/api/solve`, `/api/compare`, …)

- **No authentication** — localhost CORS only. Must not be exposed publicly without a gateway auth layer.

---

## 5. Threat scenarios (expected denials)

| Attempt | Expected |
|---------|----------|
| Change own `roles` / `organizationId` | Denied by rules |
| Analyst creates order / assigns driver / changes delivery | Denied by rules (+ UI readOnly) |
| Driver reads another driver’s delivery | Denied by rules |
| Cross-org document access | Denied by `inOrg` |
| Modify `auditLogs` after create | Denied |
| Call optimize-live without dispatcher/admin | HTTP 403 |
| Call optimize-live with wrong `organization_id` | HTTP 403 |
| Invalid / missing Bearer on `/api/ops/me` | HTTP 401 |

Live denial evidence must be re-run after rule changes — see `docs/PRODUCTION_READINESS.md`.

---

## 6. Secrets

| Path | Policy |
|------|--------|
| `.env`, `.env.*`, `frontend/.env.local` | Gitignored |
| `secrets/` | Gitignored |
| `secrets/firebase-service-account.json` | **Never commit** |
| Demo passwords | Local secrets file only |

---

## 7. Known residual risks

1. Unauthenticated lab APIs.
2. Permissive `auditLogs` create.
3. JWT fallback + demo profile fallback outside Admin mode.
4. Best-effort client audit/notifications (not tamper-evident).
5. Multi-role demo users inflate privilege for convenience.

Treat these as **blocking** for production until remediated.
