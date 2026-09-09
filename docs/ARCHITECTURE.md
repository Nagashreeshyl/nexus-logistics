# Architecture: JP-019 Last-Mile Dispatch Console

Build bible for the working demo. Visual tokens and screens live in [`DESIGN.md`](../DESIGN.md). This file covers stack, data, solvers, APIs, repo layout, and the spoken demo.

**Constraint:** hard capacity and time windows are never relaxed by AI. Late-risk is overlay-only. When a full plan is infeasible, return partial feasible routes plus a prioritized deferred list.

---

## V2 operational control center (branch `v2`)

```text
Nexus Logistics
  → Role workspaces (Admin / Dispatcher / Driver / Analyst)
  → Live Firestore (SoR)
  → OR-Tools CVRPTW (hard constraints)
  → ML late-risk (advisory)
  → Exception-driven reoptimization
  → Analyst metrics + optimizationRuns audit
```

See `docs/DEMO_RUNBOOK.md`, `docs/SECURITY.md`, `docs/TESTING.md`, `docs/REALTIME_ARCHITECTURE.md`.

---

## 1. Goal

Python + React MVP that:

1. Assigns orders to vehicles
2. Builds feasible delivery sequences
3. Respects capacity and time windows
4. Flags likely late deliveries
5. Prioritizes critical orders
6. Beats a naive baseline on measurable metrics

No GPS hardware. No paid live-map API. Synthetic or public data only.

---

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| UI | Vite + React + TypeScript + Tailwind | Vertex/Agency look cannot be done in Streamlit |
| Map | Plotly.js or SVG canvas on synthetic lat/lon | No Mapbox/Google |
| API | FastAPI (CORS for Vite) | Thin JSON over in-process solvers |
| Routing | Google OR-Tools CVRPTW | Capacity + time windows |
| Baseline | First-fit + nearest-neighbor | Allowed to breach so the demo has red flags |
| Risk | scikit-learn (GBDT or logistic) | Advisory scores + short reasons |
| Data | Seeded CSV | Deterministic reruns |

Run locally: API `http://127.0.0.1:8000`, Vite `http://127.0.0.1:5173`.

---

## 3. System flow

```
Intro (skippable)
    → Dispatch console
        → GET /api/scenarios/{id}     empty map + orders
        → POST /api/solve baseline    naive routes + breaches
        → POST /api/solve optimize    OR-Tools (+ disjunction fallback)
        → Click stop                  risk already on each stop in the payload
```

```
CSVs → distance matrix (euclidean → minutes @ ~25 km/h)
     → baseline OR optimizer
     → if optimize infeasible: AddDisjunction (critical >> normal), never relax TW/capacity
     → simulate ETAs, tag LATE / BREACH
     → attach p_late + reasons (sklearn)
     → metrics + deltas vs baseline (frontend stores last baseline for the scenario)
```

---

## 4. Synthetic data

Paths:

- `backend/data/scenario_a/orders.csv`
- `backend/data/scenario_a/vehicles.csv`
- `backend/data/scenario_b/orders.csv`
- `backend/data/scenario_b/vehicles.csv`
- `backend/data/history.csv` (shared, ~400 rows)

Generator must be seeded (e.g. `seed=19`) so reruns match.

### 4.1 Orders

| Column | Type | Notes |
|---|---|---|
| `order_id` | string | e.g. `ORD-001` |
| `lat`, `lon` | float | Cluster around 12.97, 77.59 (Bengaluru-ish) |
| `demand` | int | Parcel size; must fit some vehicle |
| `tw_start`, `tw_end` | int | Minutes from 08:00 |
| `service_min` | int | Dwell at stop |
| `priority` | enum | `critical` \| `normal` |
| `zone` | string | For historical lateness features |

### 4.2 Vehicles

| Column | Type | Notes |
|---|---|---|
| `vehicle_id` | string | e.g. `VAN-1` |
| `capacity` | int | Binding |
| `depot_lat`, `depot_lon` | float | Shared depot |
| `shift_start`, `shift_end` | int | Minutes from 08:00 |

Use **3 vehicles**. Scenario A: **12–18 orders**, windows that admit a full feasible plan. Scenario B: same fleet, more demand and/or tighter windows so at least some orders must be dropped.

### 4.3 History (risk training)

Columns should include zone, demand, depot distance, window width, load pct, travel variance, `was_late` (0/1), optional `delay_min`. Enough rows to train a small classifier at API startup.

---

## 5. Solver rules

### 5.1 Distance

Euclidean or haversine on lat/lon → km. Travel minutes = km / 25 km/h × 60. Integer minutes for OR-Tools.

### 5.2 Baseline (`mode=baseline`)

1. Sort orders: critical first, then earliest `tw_end`.
2. First-fit assign to vehicles by remaining capacity (may still overload if demand is messy — show it).
3. Nearest-neighbor sequence from depot.
4. Simulate arrival = previous depart + travel + service.
5. Tag `BREACH` if load > capacity or arrival outside window / shift. Tag `LATE` if arrival > `tw_end`.

Baseline **may violate** hard constraints. That is the contrast for judges.

### 5.3 Optimize (`mode=optimize`)

OR-Tools `RoutingModel`:

- Capacity dimension = vehicle capacities, demand at nodes
- Time dimension = windows + service + vehicle shift
- Depot start and end
- First solution strategy deterministic (e.g. `PATH_CHEAPEST_ARC`)
- Time limit 5–8 seconds
- Log search: attempted vs accepted (especially dropped disjunctions)

**Never** widen windows or inflate capacity to get a “pretty” map.

### 5.4 Fallback

`AddDisjunction` on order nodes:

- Critical drop penalty: very large (must keep if any feasible slot exists)
- Normal drop penalty: smaller

Return:

- Feasible routes only
- `unassigned[]` sorted critical-then-due
- `constraint_log`: dropped ids, reason `infeasible_under_hard_constraints`

If still infeasible: empty `routes`, all orders in `unassigned`. Never a violating “optimized” plan.

---

## 6. Late-risk overlay

Train at process start on `history.csv`. Suggested model: `GradientBoostingClassifier` (fallback logistic regression).

Features (from the **solved** stop, not used to change assignment):

- Distance from depot
- Window width
- Sequence index
- Vehicle load %
- Zone historical lateness rate
- ETA slack (`tw_end - eta`)
- Demand

Output per stop:

```json
{
  "order_id": "ORD-007",
  "p_late": 0.73,
  "reasons": [
    "tight 25-min window",
    "zone historical lateness 41%",
    "late in sequence"
  ]
}
```

UI copy: `ML overlay — does not change the plan`.

---

## 7. Metrics

Computed on the simulated solution:

| Key | Meaning |
|---|---|
| `late_count` | Stops with ETA > tw_end |
| `distance_km` | Sum of legs |
| `time_min` | Sum of travel (+ optional service) |
| `capacity_breaches` | Vehicles with load > capacity |
| `tw_violations` | Stops outside window |
| `hard_breaches` | capacity_breaches + tw_violations |
| `unassigned_count` | Deferred |
| `criticals_served` | Critical orders on a route |

Frontend delta = `optimize[k] - baseline[k]` for the same scenario. Negative late/breach/distance is a win (lime). Positive is coral.

---

## 8. HTTP API

Base: `/api`. JSON. CORS allow Vite origin.

### `GET /api/health`

`{ "ok": true }`

### `GET /api/scenarios`

```json
[
  { "id": "a", "code": "SYS.01", "name": "Feasible_Day", "order_count": 16, "vehicle_count": 3 },
  { "id": "b", "code": "SYS.02", "name": "Overconstrained", "order_count": 24, "vehicle_count": 3 }
]
```

### `GET /api/scenarios/{id}`

Orders, vehicles, depot. Used to paint the empty map before a solve.

### `POST /api/solve`

Request:

```json
{ "scenario_id": "a", "mode": "baseline" }
```

`mode` is `baseline` | `optimize`.

Response (shape to keep stable):

```json
{
  "scenario_id": "a",
  "mode": "optimize",
  "feasible": true,
  "partial": false,
  "metrics": { "late_count": 0, "distance_km": 42.1, "time_min": 186, "hard_breaches": 0, "unassigned_count": 0, "criticals_served": 4 },
  "routes": [
    {
      "vehicle_id": "VAN-1",
      "load": 18,
      "capacity": 25,
      "polyline": [[12.97, 77.59], [12.98, 77.61]],
      "stops": [
        {
          "order_id": "ORD-001",
          "seq": 1,
          "eta_min": 35,
          "tw_start": 20,
          "tw_end": 80,
          "late": false,
          "breach": false,
          "priority": "critical",
          "risk": { "p_late": 0.22, "reasons": ["adequate window slack"] }
        }
      ]
    }
  ],
  "unassigned": [],
  "constraint_log": []
}
```

On scenario B optimize, `partial: true`, `unassigned` filled, banner uses `unassigned.length`.

Errors: 400 unknown scenario/mode; 500 solver exception with `{ "detail": "..." }`. Frontend shows retry.

---

## 9. Repo layout

```
DESIGN.md
docs/ARCHITECTURE.md
README.md
requirements.txt
backend/
  app/
    main.py          # FastAPI routes
    models.py        # dataclasses / pydantic
    distance.py
    baseline.py
    optimizer.py
    fallback.py
    risk.py
    metrics.py
    data_loader.py
  data/
    history.csv
    scenario_a/
    scenario_b/
frontend/
  package.json
  src/
    pages/Intro.tsx
    pages/Console.tsx
    components/
      Scoreboard.tsx
      CityMap.tsx
      VehicleRail.tsx
      RiskInspector.tsx
      DeferredList.tsx
      ShapeMark.tsx
    assets/shapes/   # vendored shapes.gallery SVGs
    styles/tokens.css
```

---

## 10. Frontend behavior notes

- Store `lastBaseline` per scenario to compute deltas after optimize.
- Switching A/B clears routes, metrics, inspector, and deltas.
- Optimize and Baseline disable while `solving`.
- Risk inspector reads `stops[].risk` from the current solution — no extra round-trip required (optional `GET` later).
- Follow [`DESIGN.md`](../DESIGN.md) for color, type, shapes, and copy.

---

## 11. Demo script (3–4 minutes)

1. Intro → **Enter console**. Scenario **A**. **Run baseline**. Point at coral `LATE` / `BREACH` nodes. Read late count, distance, hard breaches.
2. **Optimize**. Polylines redraw. KPI deltas lime. Hard breaches → 0. Say capacity and windows stayed binding.
3. Click a stop. Read `p_late` and reasons. Say: “ML ranks risk. It does not break hard constraints.”
4. Scenario **B**. **Optimize**. Fallback banner. Deferred list, criticals still on vans. “No fake perfect plan.”

---

## 12. Definition of done

- `DESIGN.md` and this file match the running app
- `uvicorn` + `npm run dev` show the console with sample data
- Baseline vs optimize numeric improvement on scenario A
- Explainable late-risk on a clicked stop
- Scenario B returns partial routes + prioritized unassigned
- README: install, run, demo script, shapes.gallery credit (Mo)
