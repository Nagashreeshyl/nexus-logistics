# Operations Runbook — Nexus Logistics V2

**Audience:** operators running the hackathon / demo stack locally  
**Branch:** `v2`  
**Related:** `docs/HACKATHON_DEMO_RUNBOOK.md`, `docs/FIREBASE_SETUP.md`, `docs/PRODUCTION_READINESS.md`

---

## 1. Prerequisites

- Node.js 20+ (frontend)
- Python 3.11+ with repo `.venv`
- Firebase project `nexus-2a448` (or your configured project)
- Optional: Redis (`docker compose up -d redis`)
- Optional demo travel: `JP019_TRAVEL=haversine`

---

## 2. Environment

### Frontend (`frontend/.env.local`)

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=nexus-2a448
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_API_BASE_URL=http://127.0.0.1:8000
```

### Backend (repo `.env`, gitignored)

```bash
FIREBASE_PROJECT_ID=nexus-2a448
GOOGLE_APPLICATION_CREDENTIALS=./secrets/firebase-service-account.json
NEXUS_ORG_ID=nexus-demo
NEXUS_DEMO_EMAILS=...
```

**Never commit** `.env`, `.env.local`, or `secrets/firebase-service-account.json`.

### Auth modes

| Mode | When | `/api/ops/health` |
|------|------|-------------------|
| `admin_sdk` | SA file / credentials present | `firebase_configured=true` |
| `jwt_fallback` | `FIREBASE_PROJECT_ID` only | `firebase_configured=false`, `firebase_auth_ready=true` |
| `none` | Missing project + credentials | Ops auth unavailable |

Prefer **Admin SDK** for demos that must hit Firestore from the server.

---

## 3. Start services

```bash
# Backend
cd backend
JP019_TRAVEL=haversine ../.venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Frontend
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

Health checks:

```bash
curl -s http://127.0.0.1:8000/api/health
curl -s http://127.0.0.1:8000/api/ops/health
```

---

## 4. Demo users

1. Create Auth users in Firebase Console (email/password).
2. Provision roles:

```bash
cd backend
../.venv/bin/python scripts/provision_demo_users.py
```

Credentials for local demos may live in `secrets/demo-credentials.local.json` (gitignored).

---

## 5. Deploy rules / indexes

```bash
npx -y firebase-tools@latest use nexus-2a448
npx -y firebase-tools@latest deploy --only firestore:rules
npx -y firebase-tools@latest deploy --only firestore:indexes
```

---

## 6. Standard demo flow

1. Login (multi-role demo account).
2. Dispatcher → Scenarios → Reset (wait for Progress) → Generate Busy Day / Vehicle Breakdown.
3. Optimize → Optimize with Nexus AI → review Baseline vs Nexus → Approve plan.
4. Workspace → Driver (no logout) → Start → Arrived → Complete.
5. Exceptions → mark vehicle BREAKDOWN → Reoptimize → review BEFORE/AFTER → Approve.
6. Analyst → read metrics only.

Full judge script: `docs/HACKATHON_DEMO_RUNBOOK.md`.

---

## 7. Troubleshooting

| Symptom | Action |
|---------|--------|
| Optimize disabled | Regenerate scenario with open orders + vehicles |
| `firebase_configured=false` | Add SA JSON + `GOOGLE_APPLICATION_CREDENTIALS` |
| CTA “Writing…” forever | Ensure V2.15+ build (non-blocking audit); check network/rules |
| Scenario reset hangs | Reload; Progress should timeout per collection; retry |
| Driver empty | Approve plan; ensure delivery `driverUserId` is presenter UID |
| Connection not Live | Rules, org mismatch, or network — do not claim live sync |
| Optimize 401/403 | Re-login; `GET /api/ops/me` with Bearer token |
| Optimize 500 | Check uvicorn traceback; restart backend |

---

## 8. Incident honesty

- Do **not** silently approve reoptimization plans.
- Do **not** invent GPS / production ML claims.
- If audit/notification enqueue fails, operational write may still succeed — treat audit as best-effort unless Admin + durable path verified.
- Prefer showing real optimizer errors over fake success.

---

## 9. Shutdown

Stop uvicorn and Vite processes. Optional: `docker compose down` for Redis.
