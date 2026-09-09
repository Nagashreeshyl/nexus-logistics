# Vercel deployment (frontend)

Nexus Logistics V2 frontend deploys as a Vite SPA on Vercel.

## Important limits

- **Vercel hosts the React app only** (Auth + Firestore work in the browser).
- The **FastAPI / OR-Tools backend is not deployed by this Vercel project**.
- For Optimize / Lab APIs, set `VITE_API_BASE_URL` to a publicly reachable FastAPI URL (HTTPS).
- Do **not** set `VITE_API_BASE_URL=http://127.0.0.1:8000` in Vercel.

## Project settings

- Root directory: `frontend`
- Build command: `npm run build`
- Output: `dist`
- Framework preset: Vite

## Environment variables (Production)

Set in Vercel → Project → Settings → Environment Variables:

```text
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_API_BASE_URL   # optional until backend is hosted
```

## Firebase Auth authorized domains

In Firebase Console → Authentication → Settings → Authorized domains, add:

- `localhost`
- your Vercel domain (e.g. `nexus-logistics.vercel.app`)

## CLI deploy

```bash
cd frontend
vercel login
vercel link
vercel env pull   # or set env in dashboard
vercel --prod
```
