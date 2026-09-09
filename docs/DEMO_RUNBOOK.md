# Demo runbook — Nexus Logistics

See **[HACKATHON_DEMO_RUNBOOK.md](./HACKATHON_DEMO_RUNBOOK.md)** for the Soundarya College 5–10 minute presentation script.

## Stack (control center)

```text
Nexus Logistics
  → Premium logistics control center
  → Admin / Dispatcher / Driver / Analyst workspaces
  → Live Firestore (source of truth)
  → OR-Tools (hard constraints)
  → ML Risk (advisory triage)
  → Dynamic reoptimization (exceptions → replan)
  → Analytics (baseline vs Nexus AI + audit runs)
```

## Prerequisites

1. Branch `v2` checked out  
2. Firebase project `nexus-2a448` configured (`frontend/.env.local`, Admin credentials for backend)  
3. Demo users provisioned (`backend/scripts/provision_demo_users.py`)  
4. Firestore rules deployed  
5. Frontend: `cd frontend && npm run dev` → http://127.0.0.1:5173  
6. Backend: `../.venv/bin/uvicorn app.main:app --reload --port 8000`

## Reset / generate

Scenario Studio → **Reset Demo Scenario** (synthetic only) → **Generate Demo Scenario**.
