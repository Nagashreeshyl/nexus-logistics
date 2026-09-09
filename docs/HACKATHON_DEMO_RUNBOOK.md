# Hackathon Demo Runbook — Soundarya College

**Product:** Nexus Logistics (branch `v2`)  
**Audience:** 5–10 minute judge presentation  
**Firebase project:** `nexus-2a448`  
**V2.15 status:** live integration repair (not a feature milestone)

---

## VERIFIED (this environment)

| Item | Evidence |
|------|----------|
| Frontend typecheck / lint / build | `npm run typecheck`, `lint`, `build` — PASS |
| Frontend selftests | `test:roles`, `test:delivery`, `test:ops` — PASS |
| Backend pytest | **26 passed** |
| ML artifacts (unchanged) | pre-route AUC **0.7713**, post-route AUC **0.768** |
| Optimizer smoke | feasible on live scenario payload |
| Firebase client Auth + Firestore reads | Login + dispatcher board Live |
| Firestore rules deploy | `firebase deploy --only firestore:rules --project nexus-2a448` — Deploy complete |
| Backend token verify (JWT fallback) | `/api/ops/health` → `auth_mode: jwt_fallback`, `firebase_auth_ready: true` |
| `GET /api/ops/me` | HTTP **200** with `roles[]` (demo profile fallback if Firestore REST 429) |
| `POST /api/ops/optimize-live` | HTTP **200**, feasible, comparison rows, ML AUC 0.7713 (real OR-Tools path) |
| Driver CTA write-path fix | Critical `updateDoc` first; audit/notifications **best-effort** (non-blocking) |
| Security scan | No service-account JSON / private keys tracked; `secrets/` and `.env*` gitignored |
| Scenario Studio UI | Presets render; Generate / Reset controls present |

### Root cause: slow / hanging driver status writes

1. **Primary (fixed):** driver CTAs awaited **audit + notification** writes after the delivery `updateDoc`, so the button stayed on “Writing…” even after status changed.  
2. **Secondary (fixed):** Scenario reset used a compound `organizationId + synthetic` query **without composite indexes**, which hung `getDocs` and starved the Firestore client. Reset now uses org-scoped queries, client-side `synthetic` filter, pagination, and timeouts.  
3. **Observed residual:** under load, `updateDoc` client **acks can take ~12s+** even when the server write / listener already moved (driver showed Arrived while ack timed out). Timeout raised to 20s; driver UI ignores timeout if the listener already shows the target status.

### Audit persistence policy

- Operational writes (delivery status, reassignment, exceptions) are **authoritative** and must succeed/fail clearly.  
- **Audit + in-app notifications are best-effort** (`enqueueAudit` / `enqueueNotification`): attempted after the critical write; failures are `console.warn` only — **not a durable queue**.  
- Do not claim guaranteed audit for every CTA under Firestore rate limits.

---

## NOT VERIFIED (do not claim PASS)

| Item | Notes |
|------|--------|
| Firebase Admin SDK (`firebase_configured=true`) | No `secrets/firebase-service-account.json` in this workspace — JWT fallback used instead |
| Dual independent browser sessions (Dispatcher ‖ Driver) | Same-account workspace switch exercised; true dual-profile sessions not completed |
| Full Driver → Dispatcher metric sync after every CTA | Driver UI showed Arrived; dispatcher metric strip still showed Arrived=0 in one check — treat as **needs re-check on clean network** |
| Dispatcher → Driver reassignment live | Not completed this pass |
| Scenario generate + reset end-to-end | Reset previously hung; code fixed — **full reset success not re-confirmed after fix** |
| Vehicle breakdown → reopt → before/after → approve | Not completed this pass |
| Analyst write-block (UI + rules live attempt) | Rules deploy OK; live analyst denial attempts not re-run |
| Audit docs present in Firestore for all event types | Best-effort only; not inventory-checked |
| Complete uninterrupted 5–10 min demo | Partial only |

---

## Local setup

### Frontend / backend

```bash
cd frontend && npm run dev          # http://127.0.0.1:5173
cd backend && JP019_TRAVEL=haversine ../.venv/bin/uvicorn app.main:app --reload --port 8000
```

Confirm Vite proxies `/api` → backend.

### Firebase Admin (preferred) vs JWT fallback

**Preferred (Admin SDK):**

1. Download a service account JSON from Firebase Console (never commit it).  
2. Save as `secrets/firebase-service-account.json` (gitignored).  
3. In repo `.env` (gitignored):

```bash
FIREBASE_PROJECT_ID=nexus-2a448
GOOGLE_APPLICATION_CREDENTIALS=./secrets/firebase-service-account.json
```

Then `/api/ops/health` should report `auth_mode: admin_sdk`, `firebase_configured: true`.

**Without Admin JSON (hackathon laptop):** set `FIREBASE_PROJECT_ID=nexus-2a448`. Backend verifies ID tokens via Google certs (`jwt_fallback`). Profile load uses Firestore REST with the caller token; on **429**, known demo emails may use `demo_fallback_profile` (still requires a **valid** Firebase ID token — not a bypass of signature verification).

### Demo users

Credentials live only in `secrets/demo-credentials.local.json` (gitignored).

---

## Recommended 5–10 minute flow

| Step | Action | Expect |
|------|--------|--------|
| 1 | Login (multi-role demo account) | Real Firebase Auth |
| 2 | Dispatcher → **Scenarios** | Synthetic Scenario Engine |
| 3 | **Reset Demo Scenario** (wait for Progress) → **Generate** Busy Day or Vehicle Breakdown | Progress → SCENARIO READY |
| 4 | Orders / Fleet / Drivers | Live Firestore tables |
| 5 | **Optimize** → Optimize with Nexus AI | Real `/api/ops/optimize-live` result (show error if infeasible — do not fake) |
| 6 | Baseline vs Nexus table | Computed metrics |
| 7 | Approve plan | Assignments in Firestore |
| 8 | Workspace → **Driver** (no logout) | Route for this UID |
| 9 | Start → Arrived → Complete | Watch console `[realtime] … write_ms=`; dispatcher board should follow via `onSnapshot` |
| 10 | Exceptions → vehicle BREAKDOWN → Reoptimize | BEFORE / AFTER — **manual Approve** |
| 11 | Analyst | Read metrics/audit; writes must fail if attempted |

---

## Realtime troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| CTA stuck on Writing… | Old build awaiting audit | Ensure V2.15 ops write-path (non-blocking audit) |
| Reset hangs on Scanning… | Rate limit / hung query | Wait, reload, retry; Progress should timeout with error ≤12s/collection |
| Optimize 401/403 | Token/roles | Re-login; check `/api/ops/me` |
| Optimize 500 `snap_roads` | Fixed import from `metrics` | Restart uvicorn if stale |
| `firebase_configured=false` | No Admin SA | Expected with JWT fallback; not required for optimize-live once auth_ready |
| Connection not Live | Rules / network | Redeploy rules; check badge |

---

## Talking points (honest)

- OR-Tools owns **hard** constraints; ML late-risk is **advisory** (AUC above).  
- Realtime = Firestore `onSnapshot` only.  
- Synthetic data: `synthetic: true` / `dataSource: synthetic`; reset deletes **only** synthetic org docs.  
- Never claim Admin SDK, dual-browser proof, or full demo PASS unless re-verified on the presentation machine.

---

## Do not claim

- Live GPS tracking  
- Production-validated ML  
- Automatic plan approval  
- Guaranteed audit under all network conditions  
- `firebase_configured=true` without a local service-account file
