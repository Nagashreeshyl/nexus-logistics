# Open-source stack & stretch roadmap

What ships now (all free / open):

| Piece | Project | Role |
|---|---|---|
| Solver | [Google OR-Tools](https://developers.google.com/optimization) | CVRPTW with hard capacity & time windows |
| Roads | [OSRM](https://project-osrm.org/) / OpenStreetMap | Travel matrix + snapped polylines |
| Map | [Leaflet](https://leafletjs.com/) + OSM tiles | Interactive Bengaluru map |
| Weather | [Open-Meteo](https://open-meteo.com/) | Live Bengaluru conditions → risk context only |
| Geocode | [Nominatim](https://nominatim.org/) | Depot address verification |
| DB | SQLite | Orders, vans, holds, solve history |
| Cache | Redis (optional) / in-memory TTL | Matrices, weather, solves |
| Risk | scikit-learn | Late-probability overlay (never relaxes constraints) |

## High-impact additions (still open-source)

1. **Valhalla** or self-hosted OSRM — lower latency, traffic-aware costing when you host the graph.
2. **MapLibre GL** + free vector tiles (OpenMapTiles / Protomaps) — sharper cartography, 3D tilt for demos.
3. **Turf.js** — catchment polygons, stop clustering, drive-time isochrones in the browser.
4. **Photon** (Komoot) — typeahead address search over OSM.
5. **Overpass API** — density of apartments/offices near a stop as a risk feature.
6. **Grafana + Prometheus** — ops SLO dashboards for solve latency / cache hit rate.
7. **Prefect / Dagster** — nightly retrain of the risk model on historical ETAs.
8. **PostGIS** — when you outgrow SQLite for multi-city fleets.
9. **OpenAPI + FastAPI clients** — typed SDKs for mobile driver apps.
10. **Playwright** — CI visual + flow tests (baseline → optimize → hold).

## Product bar for “company ready”

- Constraint honesty: ML never overrides capacity/windows (already).
- Observability: cache mode, travel source, Nominatim verify, solve history (already).
- Exports: CSV manifest + GeoJSON (already).
- UX: loading stages, toasts, empty KPIs as “Awaiting plan”, keyboard shortcuts, help tips.
- Next: auth (Keycloak), multi-tenant orgs, webhook events, SLA reporting.
