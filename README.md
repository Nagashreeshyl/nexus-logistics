# Nexus Logistics

**Last-Mile Delivery Route Optimizer & Late-Delivery Risk Predictor**

**Avishkara’26 · Problem statement JP-019 · Team Code with Errors**

| | |
|---|---|
| **Product** | Nexus Logistics |
| **Team** | Code with Errors |
| **Members** | Naga Shreeshyl K S (Team Leader · Developer) · Nivetha (Research · Presenter) · Ankitha (Research · Presenter) · Skanda (Tester) |
| **Live app** | [nexusaidecisionengine.vercel.app](https://nexusaidecisionengine.vercel.app) |
| **API** | [nexus-logistics-api.vercel.app](https://nexus-logistics-api.vercel.app) |
| **Judge deck** | [/presentation](https://nexusaidecisionengine.vercel.app/presentation) |
| **Optimizer Lab** | [/optimizer](https://nexusaidecisionengine.vercel.app/optimizer) |

Hard **capacity** and **time windows** are never relaxed. Late-delivery risk is an ML **advisory** signal only. If a day cannot be fully served, Nexus returns a **partial feasible plan** plus deferred stops — never a fake “100% success.”

> **Data honesty:** Demo scenarios and historical records used for model development are **synthetic Bengaluru demonstration data**, not real operational telemetry. Solvers and risk scores still run for real on that data.

---

## What we built

Nexus plans last-mile van routes under real constraints, warns which stops may still arrive late, and **proves** improvement against a naive baseline on the same day.

1. **Build routes** — Google OR-Tools CVRPTW (hard capacity + time windows).
2. **Warn late risk** — scikit-learn Gradient Boosting (advisory only; never overrides the solver).
3. **Prove it** — Baseline vs Nexus compare with measured late count, distance, on-time %, and travel source (`OSRM` or `Haversine`).

### Optimizer Lab (auth-free judge path)

Multi-page Lab under `/optimizer`:

| Page | Purpose |
|---|---|
| Overview | Session big picture |
| Scenario | Day A/B + synthetic archetypes (Load) |
| Plan | Side-by-side Baseline vs Nexus maps + Play |
| Risk | High late-risk stops |
| Exceptions | Rush / disruption before–after |
| Analytics | Live bars from Optimize results |
| Evidence | JP-019 checklist / honesty board |
| Exports | Driver sheet · GeoJSON · weather · return to Thank you |

Presenter script: [`docs/Nexus_Presenter_Script.pdf`](docs/Nexus_Presenter_Script.pdf)  
PPT file (submission): [`docs/Nexus_Logistics_JP019_Presentation.pptx`](docs/Nexus_Logistics_JP019_Presentation.pptx)

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React · Vite · TypeScript · Tailwind · Leaflet | Interactive Lab, maps, presentation |
| Backend | FastAPI | Solve · compare · Lab APIs |
| Optimizer | Google OR-Tools | Feasible CVRPTW under hard rules |
| ML | scikit-learn | Late-risk score (advisory) |
| Data | SQLite | Day A/B + synthetic Lab scenarios |
| Travel | OSRM → Haversine fallback | Roads when available; always labeled |
| Hosting | Vercel (SPA + Python function) | Free Hobby path for the hackathon |

**We do not use an LLM to invent routes.** Routing is mathematical optimization; risk is classical ML.

---

## Quick start (local)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Terminal 1 — API
cd backend
JP019_TRAVEL=haversine ../.venv/bin/uvicorn app.main:app --reload --port 8000

# Terminal 2 — UI
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) · Presentation: `/presentation` · Lab: `/optimizer`

```bash
# Optional: train / refresh late-risk artifact
python backend/scripts/train_risk_model.py

# Tests
cd backend && ../.venv/bin/pytest -q
```

### Travel & weather

| Source | Role |
|---|---|
| OpenStreetMap + Leaflet | Bengaluru map tiles |
| OSRM | Road travel times (when reachable) |
| Haversine | Automatic fallback — UI shows travel source |
| Open-Meteo | Live Bengaluru weather for risk context |

```bash
export JP019_TRAVEL=haversine   # force offline-friendly demo
```

---

## Deploy (Vercel)

See [`docs/VERCEL_DEPLOY.md`](docs/VERCEL_DEPLOY.md).

- **Frontend** project root: `frontend/` · env: `VITE_API_BASE_URL=https://nexus-logistics-api.vercel.app`
- **API** project root: repo root (`main.py`) · env: `JP019_TRAVEL=haversine`, `NEXUS_DATA_DIR=/tmp/nexus-data`

---

## Honest limitations

- Synthetic demo scenarios (disclosed).
- ML late-risk is **not** production-validated.
- Optimizer search is **time-limited** — feasible under the limit ≠ globally optimal.
- Travel may use Haversine when roads are unavailable.
- Vercel Lab SQLite under `/tmp` is ephemeral per instance (fine for demo).

---

## Docs

| Doc | Link |
|---|---|
| Design | [`DESIGN.md`](DESIGN.md) |
| Product | [`PRODUCT.md`](PRODUCT.md) |
| Architecture | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Vercel deploy | [`docs/VERCEL_DEPLOY.md`](docs/VERCEL_DEPLOY.md) |
| Presenter script (PDF) | [`docs/Nexus_Presenter_Script.pdf`](docs/Nexus_Presenter_Script.pdf) |
| PPT presentation (file) | [`docs/Nexus_Logistics_JP019_Presentation.pptx`](docs/Nexus_Logistics_JP019_Presentation.pptx) |
| AI disclosure (PDF) | [`docs/AI_Disclosure_Table.pdf`](docs/AI_Disclosure_Table.pdf) |
| Versioning | [`VERSIONING.md`](VERSIONING.md) |

---

## 7.1 AI Disclosure

Participants must disclose AI tools or services used during project development in the required submission/declaration format.

| AI DISCLOSURE FIELD | DETAIL TO PROVIDE |
|---|---|
| **Team Name** | Code with Errors |
| **AI Tool / Service** | **Cursor** (development + presentation website) · **ChatGPT** (assistance) · **Perplexity** (research) |
| **Team Member(s) Using It** | Naga Shreeshyl K S only |
| **Purpose** | Research / Coding / Debugging |
| **Brief Description** | AI tools were used only by Naga Shreeshyl K S for research, coding, and debugging. Cursor assisted development and the interactive presentation website; ChatGPT for general assistance; Perplexity for research. Output was team-reviewed. **No generative AI invents routes at runtime** — OR-Tools CVRPTW + classical ML (scikit-learn); hard constraints stay hard. Full PDF: [`docs/AI_Disclosure_Code_with_Errors.pdf`](docs/AI_Disclosure_Code_with_Errors.pdf). |

---

## License / event

Built for **Avishkara’26 · JP-019** by **Team Code with Errors**.
