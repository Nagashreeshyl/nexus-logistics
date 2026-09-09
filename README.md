# Last-Mile Delivery Route Optimizer & Late-Delivery Risk Predictor

**JP-019** · Aavishkara ’26 · Nexus Dispatch Console

Hard capacity and time windows are never relaxed. Late-risk is an ML overlay / triage signal only. When a day cannot be fully served, you get a partial feasible plan plus a prioritized deferred list.

**Historical delivery records used for model development are synthetic demonstration data**, not real operational telemetry.

Visual system: [`DESIGN.md`](DESIGN.md) · Architecture: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · Judge report: [`docs/JUDGE_REPORT.md`](docs/JUDGE_REPORT.md)

## Data, cache, live APIs

| Layer | Use |
|---|---|
| **SQLite** `backend/data/nexus.db` | System of record — scenarios, Bengaluru orders/vehicles, holds, solve history |
| **Redis** (optional) | Cache for OSRM matrices, weather, solve payloads — falls back to in-memory TTL if Redis is down |
| [OpenStreetMap](https://www.openstreetmap.org/) | Real Bengaluru street tiles (Leaflet) |
| [OSRM](https://project-osrm.org/) | Road-network travel times + snapped route polylines |
| [Open-Meteo](https://open-meteo.com/) | Live Bengaluru weather for late-risk context |

```bash
# Optional speed boost
docker compose up -d redis
# or: brew services start redis
export REDIS_URL=redis://127.0.0.1:6379/0

# Demo resilience: force haversine travel matrix (skip OSRM)
export JP019_TRAVEL=haversine
```

If OSRM is unavailable, the solver falls back to haversine automatically. The UI labels **Travel source: OSRM** or **Haversine fallback**. Weather falls back to a safe offline stub when Open-Meteo is down.

## Run locally

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Train / refresh late-risk artifact (synthetic history holdout metrics)
python backend/scripts/train_risk_model.py

# Terminal 1 — API
cd backend
../.venv/bin/uvicorn app.main:app --reload --port 8000

# Terminal 2 — UI
cd frontend
npm install
npm run dev

# Tests
cd backend && ../.venv/bin/pytest -q
```

Open [http://localhost:5173](http://localhost:5173).

## Demo script (~3–4 minutes)

1. Intro → **Enter console**.
2. **Day A · Normal** → **Compare both** → read Baseline → Optimized → Improvement table.
3. Open **Win sheet** for measured claims + honest limitations.
4. Click a stop → late-risk % (synthetic-trained overlay) → optional **Hold** → re-solve.
5. **Day B · Overloaded** → **Smart optimize** → deferred list + constraint reasons; criticals protected.
6. Note travel source label if OSRM is down (haversine fallback).

## Stack

- FastAPI · OR-Tools CVRPTW · scikit-learn · pandas
- Vite · React · Tailwind · Leaflet
- Bengaluru ops scenarios (customers, drivers, COD, zones)
