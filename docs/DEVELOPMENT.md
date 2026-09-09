# Development — Nexus Logistics V2

## Branches

- `main` / tag `v1.0.0` — frozen V1 (do not modify)
- `v2` — active development

## Frontend

```bash
cd frontend
npm install
npm run dev
npm run typecheck   # also npm run lint
npm run build
npm run test:roles
npm run test:delivery
npm run firebase:emulators
```

Copy `../.env.example` values into `frontend/.env.local` (Firebase web config).

## Backend

```bash
cd backend
../.venv/bin/python -m pytest -q
../.venv/bin/python scripts/smoke_solve.py
../.venv/bin/uvicorn app.main:app --reload --port 8000
```

## Tests ladder

| Layer | How |
|-------|-----|
| Unit | `pytest` delivery/RBAC; `npm run test:roles` / `test:delivery` |
| Emulator | `npm run firebase:emulators` + `VITE_USE_FIREBASE_EMULATOR=true` |
| Live smoke | Sign in against `nexus-2a448`, seed via Realtime Test Console, run Dispatcher↔Driver flow |

## Realtime demo

See `docs/REALTIME_ARCHITECTURE.md`.

## Provisioning

```bash
# Auth users + roles (one-shot bootstrap if needed)
../.venv/bin/python scripts/bootstrap_demo_access.py
# or after Admin credentials:
../.venv/bin/python scripts/provision_demo_users.py
```

Passwords live only under `secrets/` (gitignored).
