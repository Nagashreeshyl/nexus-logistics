# JP-019 Judge Report — Nexus Last-Mile

Live measured numbers are available in the app via **Win sheet** (`GET /api/winsheet`) and **Compare both** (`POST /api/compare`). Do not treat any static example below as authoritative for a live demo.

## Problem

Too many timed last-mile deliveries, limited van capacity, and hard customer time windows. Naive packing creates late, over-capacity, or inefficient plans.

## Solution

Constraint-aware OR-Tools CVRPTW + critical-first baseline comparison + sklearn late-risk overlay for triage/exception ranking + partial/deferred fallback.

## Architecture

- FastAPI · SQLite · optional Redis cache
- Distance: OSRM with Haversine fallback (`JP019_TRAVEL=haversine` for demo/offline matrix)
- Optimize: OR-Tools hard capacity + hard time windows + priority disjunctions
- Risk: trained artifact under `backend/data/models/` (holdout metrics in meta JSON)

## Optimization

OR-Tools CVRPTW. Feasible under a search time limit — **not claimed globally optimal**.

## ML

Two synthetic-trained models:

1. **Post-route overlay** — features include operational load/sequence after a plan exists; `eta_slack` excluded (explanation only).
2. **Pre-route triage** — separate model on depot distance, window width, demand, zone late rate only (no placeholder load/sequence).

Holdout Acc / Prec / Rec / F1 / ROC-AUC via `/api/risk/metrics`. Triage may bump normal drop cost slightly and rank deferred stops — **never relaxes hard constraints**.

## Constraints

Capacity and time windows are hard. Critical deliveries receive higher drop penalties.

## Baseline

Critical-first first-fit + nearest-neighbor. **May violate capacity** on purpose so the comparison is honest.

## Results

Use Compare / Win sheet on Day A (improvement) and Day B (partial + deferred).

## Exception handling

Partial plan → deferred list + constraint reasons → hold/release → re-solve.

## Limitations

- Synthetic late history (not real fleet telemetry)
- Public OSRM / weather / Nominatim dependencies when online
- ML not production-validated
- Optimizer time-limited search
