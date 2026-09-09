# Hackathon Demo Runbook — Soundarya College

**Product:** Nexus Logistics (branch `v2`)  
**Audience:** 5–10 minute judge presentation  
**Firebase project:** `nexus-2a448`

## Demo prerequisites

- Place a Firebase Admin service account at `secrets/firebase-service-account.json` (gitignored) and set `GOOGLE_APPLICATION_CREDENTIALS` so `/api/ops/optimize-live` can verify ID tokens.
- Without Admin credentials, client Auth + Firestore still work; live optimize endpoint returns auth configuration errors.

1. Frontend: `cd frontend && npm run dev` → http://127.0.0.1:5173  
2. Backend: `cd backend && ../.venv/bin/uvicorn app.main:app --reload --port 8000`  
3. Confirm Vite proxies `/api` to the backend  
4. Demo users already provisioned (multi-role accounts in `secrets/demo-credentials.local.json` — gitignored)

## 5–10 minute flow

| Step | Action | What judges should see |
|------|--------|------------------------|
| 1 | Login with a multi-role demo account | Real Firebase Auth — no fake login |
| 2 | Open **Dispatcher** workspace | URL `/dispatcher` |
| 3 | **Scenarios** → Reset Demo Scenario (if needed) → **Generate Demo Scenario** → Busy Day | Synthetic badges; tables fill via Firestore listeners |
| 4 | Show **Orders**, **Fleet**, **Drivers** | Live counts from Firestore |
| 5 | **Optimize** → **Optimize with Nexus AI** | Firestore → FastAPI → OR-Tools + ML |
| 6 | Show **Baseline vs Nexus AI** table | Distance, late, vehicles, deferred, utilization — computed, not invented |
| 7 | **Approve plan** | Deliveries assigned in Firestore |
| 8 | Workspace switcher → **Driver** (no logout) | Same UID; URL `/driver` |
| 9 | Driver route appears automatically | Map + sequence (synthetic locations labeled) |
| 10 | **Start Delivery** → **Arrived** → **Complete** | Dispatcher board updates without refresh |
| 11 | Back to Dispatcher → **Exceptions** → mark vehicle **BREAKDOWN** | Exception row appears |
| 12 | Click **Reoptimize** | Before/After from live OR-Tools excluding broken vehicle |
| 13 | **Approve plan** | New assignments written |
| 14 | Driver workspace updates | Reassigned stops via listeners |
| 15 | Workspace → **Analyst** | Read-only metrics + optimizationRuns audit |

## Talking points (honest)

- OR-Tools owns **hard** capacity / time-window constraints  
- ML late-risk is **advisory** (pre AUC ≈ 0.7713, post ≈ 0.768)  
- Realtime = Firestore `onSnapshot` (not polling / fake WebSockets)  
- Synthetic demo data is labeled `synthetic` / `dataSource: synthetic`  
- Reset deletes **only** `synthetic: true` org docs

## If something fails

| Symptom | Fix |
|---------|-----|
| Optimize button disabled | No open orders/vehicles — regenerate Busy Day |
| Driver empty | Approve plan first; first synthetic driver is linked to the presenter UID when generated while logged in |
| Permission errors | Confirm Firestore rules deployed; user has roles[] |
| Connection badge not Live | Network / rules — do not claim live sync |

## Do not claim

- Live GPS tracking  
- Production-validated ML  
- Automatic assignment without Approve
