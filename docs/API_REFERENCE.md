# API Reference — Nexus Logistics V2

**Branch:** `v2`  
**Base URL (local):** `http://127.0.0.1:8000`  
**Frontend proxy:** Vite forwards `/api` to the backend during `npm run dev`

---

## Auth header (ops)

```http
Authorization: Bearer <Firebase ID token>
```

Obtain token from the signed-in Firebase client (`user.getIdToken()`).

---

## Ops API (`/api/ops`)

### `GET /api/ops/health` — public

Returns Firebase Admin / auth readiness diagnostics.

Example fields:

- `firebase_configured` — Admin credentials present
- `firebase_initialized`
- `firebase_auth_ready` — can verify ID tokens
- `auth_mode` — `admin_sdk` | `jwt_fallback` | `none`
- `message`

### `GET /api/ops/me` — authenticated

Returns caller profile used for authorization (roles, org, email, uid, activeRole, auth_mode).

### `POST /api/ops/me/active-role` — authenticated

Body: `{ "activeRole": "dispatcher" }` (must be in caller `roles[]`).  
Updates presentation workspace role only.

### `GET /api/ops/admin/ping` — admin

### `GET /api/ops/dispatcher/ping` — dispatcher or admin

### `POST /api/ops/entities` — admin/dispatcher

Creates an entity in allowed collections (`drivers`, `vehicles`, `customers`, `orders`).  
Prefer client Firestore writes for full demo fidelity; this endpoint is a server-side helper.

### `GET /api/ops/entities/{collection}` — authenticated ops roles

Lists org-scoped entities. `auditLogs` further restricted to admin on this route.

### `POST /api/ops/optimize-live` — admin/dispatcher

**Live optimization** from Firestore-shaped payloads (not hardcoded scenario A).

Request (conceptual):

```json
{
  "organization_id": "nexus-demo",
  "orders": [ { "id": "...", "lat": 12.97, "lon": 77.59, "demandKg": 10, "timeWindowStart": "09:00", "timeWindowEnd": "17:00", "...": "..." } ],
  "vehicles": [ { "id": "...", "capacityKg": 100, "registrationNumber": "KA-01", "...": "..." } ],
  "depot_lat": 12.9716,
  "depot_lon": 77.5946
}
```

Behavior:

1. Verify token + roles + org match  
2. Build live scenario  
3. Baseline + OR-Tools optimize (hard constraints)  
4. Attach advisory ML risk  
5. Return metrics, comparison, feasibility / partial feasibility, explanations  

Does **not** auto-write assignments — dispatcher Approve in UI writes Firestore.

---

## Lab / V1 API (no auth)

Intended for local Optimizer Lab only. **Do not expose publicly without auth.**

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | App health + version + auth diagnostics |
| GET | `/api/risk/metrics` | ML holdout metrics (AUC) |
| GET | `/api/winsheet` | Lab KPI sheet |
| GET | `/api/weather` | Weather snapshot |
| POST | `/api/weather/refresh` | Refresh weather |
| GET | `/api/scenarios` | List lab scenarios |
| GET | `/api/scenarios/{id}` | Scenario detail |
| POST | `/api/holds` | Soft holds |
| DELETE | `/api/holds/{scenario_id}` | Clear holds |
| POST | `/api/solve` | Optimize lab scenario |
| POST | `/api/compare` | Baseline vs optimized |
| GET | `/api/briefing` | Narrative briefing |
| GET | `/api/history` | Solve history |
| GET | `/api/geojson` | Map geojson |
| GET | `/api/manifest` | Text manifest |

CORS allowlist (typical local): `http://127.0.0.1:5173`, `http://localhost:5173`.

---

## Error conventions

| Code | Meaning |
|------|---------|
| 400 | Bad payload / empty orders / scenario build error |
| 401 | Missing/invalid token |
| 403 | Role or organization mismatch / missing profile |
| 503 | Auth verification unavailable |

Optimizer infeasibility should surface as structured response fields (`feasible`, `partial`, explanations) — not fake success.

---

## Client write path (not REST)

Most operational mutations go **directly to Firestore** from the browser under security rules:

- Delivery status transitions  
- Reassignment  
- Exception create  
- Scenario generate/reset  
- Plan approval assignments  

Backend optimize-live is the exception: heavy OR-Tools + ML compute.
