# Production Readiness — Nexus Logistics V2

**Branch:** `v2`  
**Commit audited:** `6e21a2a4e506f124cde959d3525925be9f605dfd`  
**Product maturity:** Hackathon / demo control center — **not** a production logistics platform.  
**Overall verdict:** **NOT READY** for production cutover.

Statuses use a **production** bar (not a demo bar):

| Status | Meaning |
|--------|---------|
| READY | Evidence supports production use with known, acceptable residual risk |
| NEEDS ATTENTION | Core capability exists; gaps block production confidence |
| NOT READY | Missing, unsafe, or unverified for production claims |

---

## Summary matrix

| Area | Status |
|------|--------|
| Architecture | NEEDS ATTENTION |
| Security | NOT READY |
| Firebase | NEEDS ATTENTION |
| Firestore | NEEDS ATTENTION |
| RBAC | NEEDS ATTENTION |
| Realtime | NEEDS ATTENTION |
| Fleet | NEEDS ATTENTION |
| Drivers | NEEDS ATTENTION |
| Customers | NEEDS ATTENTION |
| Orders | NEEDS ATTENTION |
| Deliveries | NEEDS ATTENTION |
| Optimization | NEEDS ATTENTION |
| ML | NOT READY |
| Maps | NEEDS ATTENTION |
| Exceptions | NEEDS ATTENTION |
| Reoptimization | NEEDS ATTENTION |
| Notifications | NOT READY |
| Analytics | NEEDS ATTENTION |
| Audit | NOT READY |
| Offline resilience | NEEDS ATTENTION |
| Performance | NEEDS ATTENTION |
| Testing | NEEDS ATTENTION |

**Production tag:** **not created** — overall status is NOT READY.

---

## Architecture — NEEDS ATTENTION

- V1 lab (SQLite + unauthenticated `/api/solve`) and V2 ops (Firestore + `/api/ops/*`) coexist.
- Documented in `docs/ARCHITECTURE.md`, `docs/REALTIME_ARCHITECTURE.md`.
- Missing for production: single source of truth, deployment topology, secret rotation, auth on lab APIs.

## Security — NOT READY

- Firebase Auth is real; `roles[]` authorize; `activeRole` is UX-only.
- V1 lab routes have **no authentication**.
- `auditLogs` allow any signed-in user to `create` (spoofable).
- Without Admin SA, JWT fallback + demo profile fallback can grant multi-role profiles under REST 429.
- Evidence: `firestore.rules`, `backend/app/firebase_app.py`, `backend/app/main.py`.

## Firebase — NEEDS ATTENTION

- Project `nexus-2a448`; client config via `VITE_FIREBASE_*`.
- Admin SDK preferred; JWT fallback when SA missing (`auth_mode` on `/api/ops/health`).
- This workspace often runs with `firebase_configured=false` (no `secrets/firebase-service-account.json`).
- Setup: `docs/FIREBASE_SETUP.md`.

## Firestore — NEEDS ATTENTION

- Rules + indexes in repo; org-scoped documents; synthetic delete path for demo reset.
- Known issues: rate-limit / slow write acks under multi-listener load; scenario reset previously hung on unindexed compound queries (mitigated in V2.15).
- Schema: `docs/FIRESTORE_SCHEMA.md`, `docs/DATA_MODEL.md`.

## RBAC — NEEDS ATTENTION

- Roles: admin, dispatcher, driver, analyst — enforced in rules + FastAPI + UI gates.
- Selftests: `npm run test:roles`; `backend/tests/test_rbac_unit.py`.
- Gaps: multi-role demo users ≠ least privilege; live analyst write-denial not fully re-verified after every rules change.

## Realtime — NEEDS ATTENTION

- Write → `onSnapshot` → UI; no polling / fake WebSockets.
- Driver critical writes no longer await audit/notifications (V2.15).
- **NOT VERIFIED:** dual independent browser sessions; full dispatcher↔driver reassignment journeys under all loads.
- See `docs/HACKATHON_DEMO_RUNBOOK.md`.

## Fleet / Drivers / Customers / Orders / Deliveries — NEEDS ATTENTION

- CRUD + realtime boards exist for ops entities (`FleetPage`, `DriversPage`, `CustomersPage`, `OrdersPage`, `DispatcherOpsPage`, `DriverOpsPage`).
- Delivery state machine: `CREATED → ASSIGNED → EN_ROUTE → ARRIVED → DELIVERED` (+ `FAILED`).
- Missing for production: telematics/GPS, proof-of-delivery completeness, PII retention, scale validation.

## Optimization — NEEDS ATTENTION

- OR-Tools CVRPTW hard constraints; live path `POST /api/ops/optimize-live`.
- Baseline vs Nexus comparison returned from solver metrics (not hardcoded).
- Gaps: job queue/SLA, concurrent plan conflict handling, lab routes still unauthenticated.

## ML — NOT READY (for production risk claims)

- Artifact AUC: pre-route ≈ **0.7713**, post-route ≈ **0.768** (synthetic training disclosure).
- Advisory only; must not relax hard constraints.
- Missing: production data, drift monitoring, model governance.

## Maps — NEEDS ATTENTION

- Leaflet + OSM; OSRM with haversine fallback; synthetic locations labeled.
- **Do not claim live GPS.**

## Exceptions / Reoptimization — NEEDS ATTENTION

- Exception Center + breakdown-triggered reopt with manual Approve (`ExceptionsPage.tsx`).
- Full breakdown → approve → driver update journey not always verified end-to-end.

## Notifications — NOT READY

- In-app Firestore notifications only; best-effort enqueue; FCM not required/implemented.
- No durable delivery guarantees.

## Analytics — NEEDS ATTENTION

- Analyst dashboard derives metrics from Firestore + lab compare.
- Some KPIs are explicit proxies (e.g. on-time without telemetry).

## Audit — NOT READY

- Best-effort after critical ops writes; failures logged to console.
- Not a durable audit pipeline; backend auth audit skipped when Admin not configured.

## Offline resilience — NEEDS ATTENTION

- Connection badges; travel/weather stubs; no IndexedDB mutation queue for driver CTAs.
- Do not claim offline-first unless tested.

## Performance — NEEDS ATTENTION

- Redis/memory solve cache; known Firestore ack latency under load.
- No load-test proof at 500 orders / 100 vehicles / 100 drivers.

## Testing — NEEDS ATTENTION

- Frontend typecheck/lint/build + roles/delivery/ops selftests.
- Backend pytest (**26** tests at last verification).
- Missing: automated dual-browser E2E, rules denial suite in CI, SA-required Admin integration tests.

---

## Conditions to revisit READY

1. Firebase Admin SA configured in every environment that serves `/api/ops/*` (`firebase_configured=true`).
2. JWT / demo profile fallback disabled or gated strictly to non-prod.
3. Lab APIs authenticated or removed from production surfaces.
4. Audit create restricted; durable audit completion verified.
5. Dual-session realtime + analyst write-denial + breakdown→approve journeys verified with evidence.
6. Load test on realistic synthetic volume with usable UX.
7. Secrets, hosting, monitoring, and incident runbooks exercised.

Until then: treat Nexus Logistics V2 as a **demo-ready** operational prototype, not a production system.
