# Testing — Nexus Logistics V2

## Automated

```bash
# Frontend
cd frontend
npm run typecheck
npm run lint
npm run build
npm run test:roles
npm run test:delivery
npm run test:ops

# Backend (repo root venv)
cd backend
../.venv/bin/python -m pytest -q
../.venv/bin/python scripts/smoke_solve.py
```

## ML honesty (do not change the artifact)

Expected evaluation from the frozen model:

- pre-route AUC ≈ **0.7713**
- post-route AUC ≈ **0.768**

## Critical realtime journey (manual)

1. Dispatcher creates order → Orders table updates without refresh  
2. Dispatcher assigns delivery → Driver workspace shows stop without refresh  
3. Driver Start → Dispatcher sees EN_ROUTE  
4. Driver Arrived → Dispatcher sees ARRIVED  
5. Driver Complete → Dispatcher sees DELIVERED  

Anything not executed in the current environment must be reported as **NOT VERIFIED**.

## Live optimize

`POST /api/ops/optimize-live` accepts Firestore-shaped orders/vehicles, runs existing OR-Tools + ML triage, returns baseline vs optimize. Persisting runs writes `optimizationRuns` for Analyst listeners.
