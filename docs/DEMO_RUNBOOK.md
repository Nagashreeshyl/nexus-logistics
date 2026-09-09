# Demo runbook — Nexus Logistics

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
2. Firebase project configured (`frontend/.env.local`, Admin credentials for backend)  
3. Demo users provisioned (`backend/scripts/provision_demo_users.py`)  
4. Frontend: `cd frontend && npm run dev` → http://127.0.0.1:5173  
5. Backend: `../.venv/bin/uvicorn app.main:app --reload --port 8000`

## Workspace tour

| Role | Start | Key modules |
|------|-------|-------------|
| Admin | `/admin` | Fleet, Drivers, Customers, Orders |
| Dispatcher | `/dispatcher` | Orders, Deliveries, Optimize, Exceptions, Scenarios |
| Driver | `/driver` | My route map + delivery state machine |
| Analyst | `/analyst` | Read-only metrics + lab compare + opt run audit |

## Suggested demo path

1. **Scenario Studio** (`/dispatcher/scenarios`) → generate “Busy Day”  
2. **Orders** → inspect synthetic orders (badged)  
3. **Optimize Deliveries** → run live OR-Tools + ML → Apply assignments  
4. Switch workspace to **Driver** → map + advance stops  
5. **Exceptions** → mark breakdown → review reopt preview  
6. **Analyst** → baseline comparison + optimizationRuns timeline  

## Reset

Scenario Studio → **Reset Demo Scenario** deletes `synthetic: true` docs for the org only.
