# Testing Guide — Nexus Logistics V2

**Branch:** `v2`  
**Related:** `docs/TESTING.md`, `docs/PRODUCTION_READINESS.md`

---

## 1. Philosophy

- Prefer evidence over claims.
- Selftests cover pure logic (roles, delivery transitions, validation).
- Pytest covers solver constraints, RBAC unit semantics, delivery status helpers.
- Live Firebase journeys require credentials and are **manual or optional integration**.
- Never “greenwash” AUC or invent optimizer wins.

---

## 2. Frontend commands

```bash
cd frontend
npm run typecheck
npm run lint          # currently tsc --noEmit
npm run build
npm run test:roles    # roles.selftest.ts
npm run test:delivery # deliveryStatus.selftest.ts
npm run test:ops      # opsValidation.selftest.ts
```

---

## 3. Backend commands

```bash
cd backend
../.venv/bin/python -m pytest -q

# Optional smoke (from backend/)
JP019_TRAVEL=haversine ../.venv/bin/python - <<'PY'
from fastapi.testclient import TestClient
from app.main import app
c = TestClient(app)
print(c.get('/api/health').json().get('version'))
print(c.get('/api/risk/metrics').json().get('pre_route_metrics', {}).get('roc_auc'))
PY
```

Expected (last verified): **26** pytest tests passing; ML AUC ≈ **0.7713** / **0.768**.

---

## 4. Firebase rules

```bash
npx -y firebase-tools@latest deploy --only firestore:rules --project nexus-2a448
```

Manual denial checks (required for security claims):

1. Analyst attempts create order / assign / status change → denied  
2. Driver A attempts Driver B delivery → denied  
3. Self-update `roles` or `organizationId` → denied  
4. Cross-org read/write → denied  

---

## 5. Live ops checks (manual)

### Auth + me

```bash
# With a fresh Firebase ID token:
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:8000/api/ops/me
curl -s http://127.0.0.1:8000/api/ops/health
```

Expect `/me` HTTP 200 with `roles[]`, `organizationId`, `email`, `uid`.

### Optimize-live

Use Dispatcher Optimize UI **or** POST real order/vehicle payloads to `/api/ops/optimize-live`.  
Do not substitute Scenario A solely because live data fails — show the error.

### Realtime

Two sessions preferred:

1. Dispatcher assigns / watches board  
2. Driver Start → Arrived → Complete without refresh  

Record write_ms from browser console `[realtime] … write_ms=`.

### Scenario Studio

Reset → Progress completes → Generate → Optimize usable.

### Breakdown

BREAKDOWN → Exception → Reoptimize → BEFORE/AFTER → Approve → Driver updates.

---

## 6. Suggested journey checklist

| # | Journey | Pass criteria |
|---|---------|---------------|
| 1 | Login → optimize → assign → driver complete | Firestore status progression; no fake UI success |
| 2 | Breakdown → reopt → approve | Manual approve; drivers update via listeners |
| 3 | Analyst write attempt | Denied by rules |
| 4 | Driver isolation | Cannot read other driver’s ops |
| 5 | Scenario generate/reset | Synthetic-only delete; real data intact |
| 6 | Network failure | Error shown; no silent loss of CTA intent |

Failures must leave actionable diagnostics (HTTP body, rules error, console warn).

---

## 7. What is not automated yet

- Dual-browser Playwright/Cypress E2E against live Firebase  
- Full rules emulator suite in CI  
- Admin SDK integration tests when SA absent (must skip, not fake PASS)  
- Load test at 500 orders / 100 vehicles / 100 drivers  

Document any skipped live test as **NOT VERIFIED**, never PASS.

---

## 8. Tagging policy

Create a release/production tag **only** when `docs/PRODUCTION_READINESS.md` overall status is READY (or an explicitly scoped demo tag is agreed).  

As of the V2.30 audit: **no production tag** — platform is demo-ready with production gaps.
