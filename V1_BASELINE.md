# V1 Baseline — Stable JP-019 MVP

Frozen snapshot before V2 architecture work. Tag: **`v1.0.0`**.

## Architecture

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + Vite + Tailwind + Leaflet |
| Backend | FastAPI (Python) |
| Optimizer | Google OR-Tools CVRPTW |
| Baseline | Critical-first first-fit + nearest-neighbor |
| ML | scikit-learn GradientBoosting (post-route + pre-route triage) |
| Data | SQLite (`nexus.db` local runtime) seeded from CSV scenarios |
| Cache | Redis optional → in-memory TTL |
| Travel | OSRM with Haversine fallback (`JP019_TRAVEL=haversine` for demo) |

## Frontend

- Path: `frontend/`
- Console: Day A / Day B, Naive / Smart / Compare, map, deferred, holds, win sheet
- Logo/favicon: coral mark `#F47C59`

## Backend

- Path: `backend/app/`
- Key modules: `optimizer.py`, `baseline.py`, `risk.py`, `metrics.py`, `compare.py`, `main.py`, `db.py`, `distance.py`

## Optimizer

- Hard vehicle capacity
- Hard time windows
- Priority disjunctions (critical protection)
- Partial plan + deferred + constraint log when infeasible
- Pre-route risk triage may slightly bump normal drop cost — never relaxes hard constraints

## ML model (confirmed at freeze)

| Item | Value |
|------|--------|
| Artifact path | `backend/data/models/late_risk.joblib` |
| Meta | `backend/data/models/late_risk_meta.json` |
| Artifact version | **2** |
| Post-route ROC-AUC | **0.768** |
| Pre-route ROC-AUC | **0.7713** |
| History | Synthetic demonstration data (`backend/data/history.csv`) |
| Excluded feature | `eta_slack` (post-plan explanation only) |

## Database

- Runtime SQLite: `backend/data/nexus.db` (gitignored; recreated/seeded on startup)
- Scenario CSVs: `backend/data/scenario_a/`, `backend/data/scenario_b/`
- Synthetic history: `backend/data/history.csv`

## API status at freeze

- Health: HTTP 200
- Features include: solve, compare, winsheet, risk-metrics, holds, geojson, manifest
- Demo travel mode supported: `JP019_TRAVEL=haversine`

## Known limitations

- Synthetic late-delivery history (not real fleet telemetry)
- ML not production-validated
- Optimizer is time-limited search (not proven globally optimal)
- Public OSRM / Open-Meteo / Nominatim / OSM tiles when online
- Baseline heuristic may violate capacity (intentional for honest comparison)

## Validation commands

```bash
# Backend tests
cd backend && JP019_TRAVEL=haversine ../.venv/bin/pytest -q

# Optimizer smoke
JP019_TRAVEL=haversine .venv/bin/python backend/scripts/smoke_solve.py

# Flow verification (API must be running)
JP019_TRAVEL=haversine .venv/bin/python backend/scripts/verify_flows.py

# API health
curl -s http://127.0.0.1:8000/api/health
curl -s http://127.0.0.1:8000/api/risk/metrics

# Frontend typecheck + build
cd frontend && npm run build
```

## Restoration instructions

```bash
# From this repo
git fetch --tags
git switch main
git checkout v1.0.0

# Recreate local env
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd frontend && npm install && cd ..

# Run
export JP019_TRAVEL=haversine   # optional demo resilience
cd backend && ../.venv/bin/uvicorn app.main:app --port 8000
# other terminal:
cd frontend && npm run dev
```

SQLite is re-seeded from CSV on startup if needed. ML artifacts are committed under `backend/data/models/`.
