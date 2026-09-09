# Implementation Plan — Nexus Logistics V2

**Branch:** `v2` (V1 tag `v1.0.0` / `34f81f4` untouched)  
**Baseline verified:** pytest 13 passed · API 200 · ML artifact v2 (pre AUC 0.7713, post 0.768)

## Preserve
OR-Tools CVRPTW, baseline, risk ML, OSRM→haversine, Console as Optimizer Lab under Dispatcher.

## Milestones
| # | Focus |
|---|--------|
| v2.1 | Firebase foundation (config, firebase.json, Admin init, client SDK, env, docs) |
| v2.2 | Firestore repos + schema types |
| v2.3 | Auth + RBAC + role switcher + protected routes |
| v2.4 | Realtime hooks |
| v2.5 | Fleet / drivers / customers / orders + synthetic buttons | **Implemented on v2** |
| v2.6 | Optimizer ↔ Firestore bridge (`/api/ops/optimize-live`) | **Implemented on v2** |
| v2.7–v2.8 | Driver map + delivery state machine | **Map + existing state machine on v2** |
| v2.9 | Exceptions + reoptimization | **Exception center + reopt preview on v2** |
| v2.10 | Full scenario generator | **Scenario Studio presets on v2** |
| v2.11 | Analytics + audit | **Analyst dashboard + optimizationRuns on v2** |
| v2.12–13 | Tests + polish | **docs/SECURITY, TESTING, DEMO_RUNBOOK** |

## Rule
No hardcoded operational data. Firestore = SoR. Synthetic → same write path as real forms.
