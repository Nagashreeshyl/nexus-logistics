# Vercel deployment (frontend + FastAPI) — free Hobby, no Fly/Docker required

Nexus Logistics deploys **only on Vercel**:

1. **Frontend** — Vite SPA (`frontend/` project) → e.g. `https://nexusaidecisionengine.vercel.app`
2. **Backend** — FastAPI as a Vercel Python Function (repo root `main.py`) → separate Vercel project

Do **not** use Fly.io, Railway paid plans, or other paid hosts for the default path.

## Important limits

- Optimize / Lab need the **Python** Vercel project (`VITE_API_BASE_URL`).
- OR-Tools + sklearn must stay under the Python function bundle limit (~500MB). Use `requirements-vercel.txt`.
- SQLite Lab DB uses `/tmp/nexus-data` on Vercel (ephemeral per instance — fine for demo; cold starts re-seed Day A/B).
- Default travel mode on Vercel: `JP019_TRAVEL=haversine` (no OSRM dependency).

## 1) Deploy the API (repo root)

```bash
cd "<repo-root>"
vercel login
vercel link          # create/link project e.g. nexus-logistics-api
vercel env add JP019_TRAVEL production   # value: haversine
vercel env add NEXUS_DATA_DIR production # value: /tmp/nexus-data
vercel --prod
```

Copy the production URL (e.g. `https://nexus-logistics-api.vercel.app`).

## 2) Point the frontend at the API

In the **frontend** Vercel project → Settings → Environment Variables:

```text
VITE_API_BASE_URL=https://<your-api-project>.vercel.app
```

(No trailing slash.) Redeploy frontend after changing env:

```bash
cd frontend
vercel --prod
```

## Frontend project settings

- Root directory: `frontend`
- Build: `npm run build`
- Output: `dist`

## Frontend env (Production)

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_API_BASE_URL   # HTTPS origin of the FastAPI Vercel project
```

## CORS

Backend already allows `https://*.vercel.app`. Optionally set `CORS_ORIGINS` to your exact frontend origin.

## Firebase Auth authorized domains

Add:

- `localhost`
- your frontend Vercel domain (e.g. `nexusaidecisionengine.vercel.app`)

## Local demo (optional)

```bash
JP019_TRAVEL=haversine PYTHONPATH=backend uvicorn app.main:app --port 8000
cd frontend && npm run dev
```

## CLI — frontend only

```bash
cd frontend
vercel --prod
```
