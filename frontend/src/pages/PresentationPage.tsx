import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { readLabSession } from "../lib/labSession";

const TOTAL = 9;

const SLIDE_TITLES = [
  "Project + team",
  "The real problem",
  "CVRPTW formulation",
  "Architecture",
  "Why OR-Tools",
  "Late-risk ML",
  "Live Lab",
  "Disruption",
  "Impact",
];

function SlideFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`mx-auto flex min-h-[calc(100dvh-120px)] w-full max-w-6xl flex-col justify-center px-6 py-10 pb-24 md:px-12 ${className}`}
    >
      {children}
    </div>
  );
}

export function PresentationPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const slide = Math.min(TOTAL, Math.max(1, Number(params.get("slide") || "1") || 1));
  const [overview, setOverview] = useState(false);
  const [techOpen, setTechOpen] = useState(false);
  const [problemStep, setProblemStep] = useState(0);
  const [formMode, setFormMode] = useState<"constraints" | "optimize" | null>(null);
  const [archFocus, setArchFocus] = useState<string | null>(null);
  const [optAnim, setOptAnim] = useState(0);
  const [mlOpen, setMlOpen] = useState(false);
  const [disruptStep, setDisruptStep] = useState(0);
  const [titleAnim, setTitleAnim] = useState(false);
  const session = useMemo(() => readLabSession(), [slide]);

  const go = useCallback(
    (n: number) => {
      const next = Math.min(TOTAL, Math.max(1, n));
      setParams({ slide: String(next) }, { replace: true });
      setOverview(false);
    },
    [setParams],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (overview && e.key === "Escape") {
        setOverview(false);
        return;
      }
      if (techOpen && e.key === "Escape") {
        setTechOpen(false);
        return;
      }
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        go(slide + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(slide - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        go(1);
      } else if (e.key === "End") {
        e.preventDefault();
        go(TOTAL);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, slide, overview, techOpen]);

  const openLab = () => {
    navigate(
      `/optimizer?returnTo=${encodeURIComponent(`/presentation?slide=${slide}`)}&fromSlide=${slide}`,
    );
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen();
    else void document.exitFullscreen();
  };

  const archItems: Record<string, string> = {
    fastapi: "Connects the frontend with optimization and prediction services.",
    ortools: "Solves the constrained CVRPTW routing problem (hard capacity + time windows).",
    ml: "GradientBoostingClassifier predicts late-delivery risk — advisory only.",
    osrm: "Provides road-based distance/travel when available.",
    haversine: "Fallback great-circle distance when road routing is unavailable.",
    leaflet: "Interactive Bengaluru map for routes, stops, and risk.",
  };

  return (
    <div className="relative bg-paper text-ink">
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        @keyframes softIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes drawLine { from { stroke-dashoffset: 140; } to { stroke-dashoffset: 0; } }
      `}</style>

      <div className="absolute right-4 top-4 z-20 flex gap-2">
        <button
          type="button"
          onClick={() => setTechOpen(true)}
          className="border border-hairline bg-snow px-3 py-1.5 font-sans text-[12px] font-semibold text-mute hover:text-ink"
        >
          Technical details
        </button>
        <button
          type="button"
          onClick={() => setOverview(true)}
          className="border border-hairline bg-snow px-3 py-1.5 font-sans text-[12px] font-semibold text-mute hover:text-ink"
        >
          Overview
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="border border-hairline bg-snow px-3 py-1.5 font-sans text-[12px] font-semibold text-mute hover:text-ink"
        >
          Fullscreen
        </button>
      </div>

      {/* SLIDE 1 */}
      {slide === 1 && (
        <SlideFrame>
          <div className="relative grid gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-center">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute opacity-0 animate-[softIn_0.7s_ease_forwards]">
                Avishkara&apos;26 · JP-019
              </p>
              <h1 className="mt-4 font-sans text-[clamp(2.6rem,8vw,5rem)] font-semibold leading-[0.92] tracking-tight opacity-0 animate-[fadeUp_0.7s_ease_forwards]">
                NEXUS LOGISTICS
              </h1>
              <p className="mt-5 max-w-xl font-sans text-[clamp(1.05rem,2vw,1.3rem)] text-mute opacity-0 animate-[fadeUp_0.7s_ease_0.12s_forwards]">
                Last-Mile Delivery Route Optimizer
                <br />
                &amp; Late-Delivery Risk Predictor
              </p>
              <div className="mt-8 space-y-1 font-mono text-[12px] uppercase tracking-[0.14em] text-mute opacity-0 animate-[fadeUp_0.7s_ease_0.25s_forwards]">
                <p>Code with Errors</p>
                <p className="normal-case tracking-normal text-ink">Naga Shreeshyl K S — TL · Nivetha · Ankitha · Skanda</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTitleAnim(true);
                  window.setTimeout(() => go(2), 700);
                }}
                className="mt-10 bg-coral px-8 py-3.5 font-sans text-[14px] font-semibold text-ink opacity-0 animate-[fadeUp_0.7s_ease_0.4s_forwards]"
              >
                Enter Nexus →
              </button>
            </div>
            <svg viewBox="0 0 280 220" className="mx-auto w-full max-w-sm" aria-hidden>
              <circle cx="50" cy="110" r="10" fill="#92CFF2" stroke="#0A0A0A" strokeWidth="2" />
              <text x="50" y="140" textAnchor="middle" fontSize="10" fill="#8A8A8A" fontFamily="monospace">
                DEPOT
              </text>
              {[
                [150, 40],
                [210, 70],
                [230, 130],
                [170, 170],
                [110, 50],
                [200, 180],
              ].map(([x, y], i) => (
                <g key={i}>
                  <line
                    x1="50"
                    y1="110"
                    x2={x}
                    y2={y}
                    stroke="#F47C59"
                    strokeWidth="1.6"
                    strokeDasharray="140"
                    strokeDashoffset={titleAnim || true ? 0 : 140}
                    style={{
                      animation: titleAnim || i < 6 ? `drawLine 0.7s ease ${0.15 + i * 0.08}s forwards` : undefined,
                      strokeDashoffset: 140,
                    }}
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r="5"
                    fill="#F7F6F2"
                    stroke="#0A0A0A"
                    strokeWidth="2"
                    className="opacity-0"
                    style={{ animation: `softIn 0.4s ease ${0.1 + i * 0.08}s forwards` }}
                  />
                </g>
              ))}
            </svg>
          </div>
          <p className="mt-4 font-sans text-[13px] text-mute">Many delivery decisions across Bengaluru — capacity, windows, sequence.</p>
        </SlideFrame>
      )}

      {/* SLIDE 2 */}
      {slide === 2 && (
        <SlideFrame>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-coral">The real problem</p>
          <h2 className="mt-2 font-sans text-[clamp(1.8rem,4.5vw,2.8rem)] font-semibold leading-tight">
            Why is last-mile delivery hard?
          </h2>
          <p className="mt-2 font-sans text-[15px] text-mute">
            Bengaluru · 20–30 orders · limited vans · different capacities · different time windows · priorities
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="border border-hairline bg-snow p-4 font-sans text-[13px]">
              <p className="font-mono text-[10px] text-mute">ORD-1042</p>
              <p className="mt-1 font-semibold">10:00–10:45 · 12 kg · HIGH</p>
            </div>
            <div className="border border-hairline bg-snow p-4 font-sans text-[13px]">
              <p className="font-mono text-[10px] text-mute">ORD-1048</p>
              <p className="mt-1 font-semibold">10:30–12:00 · 8 kg · NORMAL</p>
            </div>
            <div className="border border-hairline bg-snow p-4 font-sans text-[13px]">
              <p className="font-mono text-[10px] text-mute">V03</p>
              <p className="mt-1 font-semibold">Capacity 50 kg</p>
            </div>
          </div>
          <p className="mt-5 font-sans text-[14px] text-mute">
            Every order needs: where · when · how much · which vehicle · what sequence.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-[13px]">
            <span className="border border-ink bg-[#92CFF2] px-2 py-1">Depot</span>
            {["A", "B", "C", "D"].map((n, i) => (
              <span key={n} className="flex items-center gap-2">
                <span className="text-mute">→</span>
                <span
                  className={`border px-2 py-1 ${
                    (problemStep >= 1 && i === 2) || (problemStep >= 2 && i === 0) || (problemStep >= 3 && i === 1)
                      ? "border-coral bg-[#FFF5F2] text-coral"
                      : "border-hairline bg-snow"
                  }`}
                >
                  {n}
                  {problemStep >= 1 && i === 2 ? " ✕ cap" : ""}
                  {problemStep >= 2 && i === 0 ? " ✕ window" : ""}
                  {problemStep >= 3 && i === 1 ? " ✕ van" : ""}
                </span>
              </span>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              "Add capacity constraint",
              "Add time window",
              "Add vehicle limit",
            ].map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => setProblemStep(i + 1)}
                className={`border px-3 py-2 font-sans text-[13px] font-semibold ${
                  problemStep === i + 1 ? "border-coral bg-[#FFF5F2]" : "border-hairline bg-snow"
                }`}
              >
                {label}
              </button>
            ))}
            <button type="button" onClick={() => setProblemStep(0)} className="px-3 py-2 font-sans text-[13px] text-mute underline">
              Reset
            </button>
          </div>
          <p className="mt-8 font-sans text-[18px] font-semibold">
            The goal is not just the shortest route — it is the <span className="text-coral">best feasible plan</span>.
          </p>
        </SlideFrame>
      )}

      {/* SLIDE 3 */}
      {slide === 3 && (
        <SlideFrame>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-coral">Formalize</p>
          <h2 className="mt-2 font-sans text-[clamp(1.7rem,4vw,2.6rem)] font-semibold leading-tight">
            Turning the real world into an optimization problem
          </h2>
          <div className="mt-8 grid gap-3 md:grid-cols-4">
            {[
              { t: "INPUT", d: "Orders · vehicles · locations · demand · windows · priority" },
              { t: "DECISIONS", d: "Which van · what sequence · when to arrive" },
              { t: "CONSTRAINTS", d: "Capacity · time windows · availability", on: formMode === "constraints" },
              { t: "OBJECTIVE", d: "Efficient · feasible · fewer lates", on: formMode === "optimize" },
            ].map((b) => (
              <div
                key={b.t}
                className={`border bg-snow p-4 ${b.on ? "border-coral" : "border-hairline"}`}
              >
                <p className="font-mono text-[10px] uppercase text-mute">{b.t}</p>
                <p className="mt-2 font-sans text-[13px] leading-snug">{b.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFormMode("constraints")}
              className="border border-hairline bg-snow px-4 py-2 font-sans text-[13px] font-semibold"
            >
              Show constraints
            </button>
            <button
              type="button"
              onClick={() => setFormMode("optimize")}
              className="border border-hairline bg-snow px-4 py-2 font-sans text-[13px] font-semibold"
            >
              Show optimization
            </button>
          </div>
          <div className="mt-8 border border-ink bg-snow px-5 py-5">
            <p className="font-sans text-[28px] font-semibold tracking-tight">CVRPTW</p>
            <p className="mt-1 font-sans text-[15px] text-mute">Capacitated Vehicle Routing Problem with Time Windows</p>
            <p className="mt-3 max-w-2xl font-sans text-[15px]">
              We use CVRPTW because our vehicles have capacity limits and our deliveries have time windows.
            </p>
          </div>
        </SlideFrame>
      )}

      {/* SLIDE 4 */}
      {slide === 4 && (
        <SlideFrame>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-coral">Architecture</p>
          <h2 className="mt-2 font-sans text-[clamp(1.8rem,4vw,2.8rem)] font-semibold">How Nexus works</h2>
          <div className="mt-8 flex flex-col items-stretch gap-2 font-sans text-[13px] md:flex-row md:items-center md:gap-3">
            <div className="border border-hairline bg-snow px-3 py-3 text-center font-semibold opacity-0 animate-[fadeUp_0.45s_ease_forwards]">
              Delivery data
            </div>
            <span className="hidden text-mute md:inline">→</span>
            <div className="border border-hairline bg-snow px-3 py-3 text-center opacity-0 animate-[fadeUp_0.45s_ease_0.08s_forwards]">
              Scenario
            </div>
            <span className="hidden text-mute md:inline">→</span>
            <button
              type="button"
              onClick={() => setArchFocus("fastapi")}
              className={`border px-3 py-3 text-center font-semibold opacity-0 animate-[fadeUp_0.45s_ease_0.16s_forwards] ${
                archFocus === "fastapi" ? "border-coral bg-[#FFF5F2]" : "border-hairline bg-snow"
              }`}
            >
              FastAPI
            </button>
            <span className="hidden text-mute md:inline">→</span>
            <div className="flex flex-col gap-2 opacity-0 animate-[fadeUp_0.45s_ease_0.24s_forwards]">
              <button
                type="button"
                onClick={() => setArchFocus("ortools")}
                className={`border px-3 py-2 text-left font-semibold ${
                  archFocus === "ortools" ? "border-coral bg-[#FFF5F2]" : "border-hairline bg-snow"
                }`}
              >
                OR-Tools CVRPTW
              </button>
              <button
                type="button"
                onClick={() => setArchFocus("ml")}
                className={`border px-3 py-2 text-left font-semibold ${
                  archFocus === "ml" ? "border-coral bg-[#FFF5F2]" : "border-hairline bg-snow"
                }`}
              >
                Gradient Boosting
              </button>
            </div>
            <span className="hidden text-mute md:inline">→</span>
            <div className="border border-ink bg-snow px-3 py-3 text-center font-semibold opacity-0 animate-[fadeUp_0.45s_ease_0.32s_forwards]">
              Routes + risk → map
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => setArchFocus("osrm")} className="border border-hairline bg-snow px-3 py-1.5 text-[12px] font-semibold">
              OSRM
            </button>
            <button type="button" onClick={() => setArchFocus("haversine")} className="border border-hairline bg-snow px-3 py-1.5 text-[12px] font-semibold">
              Haversine fallback
            </button>
            <button type="button" onClick={() => setArchFocus("leaflet")} className="border border-hairline bg-snow px-3 py-1.5 text-[12px] font-semibold">
              Leaflet map
            </button>
          </div>
          {archFocus && (
            <p className="mt-5 max-w-2xl border border-hairline bg-snow px-4 py-3 font-sans text-[14px] text-mute">
              <span className="font-semibold text-ink">{archFocus.toUpperCase()}</span> — {archItems[archFocus]}
            </p>
          )}
          <p className="mt-6 font-sans text-[13px] text-mute">No external LLM API. Optimization is mathematical — not generative AI.</p>
        </SlideFrame>
      )}

      {/* SLIDE 5 */}
      {slide === 5 && (
        <SlideFrame>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-coral">Algorithm</p>
          <h2 className="mt-2 font-sans text-[clamp(1.8rem,4vw,2.8rem)] font-semibold">Why CVRPTW + OR-Tools?</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="border border-hairline bg-snow p-5 font-sans text-[14px]">
              <p className="font-mono text-[11px] uppercase text-mute">Objective</p>
              <p className="mt-2 font-semibold">Minimize routing cost</p>
              <p className="mt-3 font-mono text-[11px] uppercase text-mute">Subject to</p>
              <ul className="mt-2 space-y-1 text-mute">
                <li>1. Capacity constraint (hard)</li>
                <li>2. Time-window constraint (hard)</li>
                <li>3. Route continuity</li>
                <li>4. Vehicle assignment</li>
              </ul>
            </div>
            <div className="border border-hairline bg-snow p-5 font-sans text-[14px]">
              <p className="font-mono text-[11px] uppercase text-mute">Google OR-Tools · 9.11</p>
              <p className="mt-3">
                <span className="font-semibold">PATH_CHEAPEST_ARC</span>
                <br />
                <span className="text-mute">First solution — builds an initial routing plan.</span>
              </p>
              <p className="mt-3">
                <span className="font-semibold">GUIDED_LOCAL_SEARCH</span>
                <br />
                <span className="text-mute">Improves routes, escapes poor local solutions.</span>
              </p>
              <p className="mt-4 border-t border-hairline pt-3 font-semibold text-coral">
                Hard constraints stay hard. ML never relaxes capacity or windows.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOptAnim((n) => (n >= 3 ? 0 : n + 1))}
            className="mt-6 bg-coral px-5 py-3 font-sans text-[14px] font-semibold"
          >
            Watch optimization (conceptual)
          </button>
          <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-[13px]">
            <span className="border border-ink bg-[#92CFF2] px-2 py-1">Depot</span>
            {(optAnim < 2 ? ["A", "B", "C"] : ["A", "C", "B"]).map((n) => (
              <span key={n + optAnim} className="flex items-center gap-2">
                <span className="text-mute">→</span>
                <span className="border border-hairline bg-snow px-2 py-1">{n}</span>
              </span>
            ))}
            <span className="text-mute">→</span>
            <span className="border border-ink bg-[#92CFF2] px-2 py-1">Depot</span>
          </div>
          <p className="mt-2 font-mono text-[11px] text-mute">Conceptual visualization — not the live solver.</p>
        </SlideFrame>
      )}

      {/* SLIDE 6 */}
      {slide === 6 && (
        <SlideFrame>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-coral">Machine learning</p>
          <h2 className="mt-2 font-sans text-[clamp(1.6rem,4vw,2.5rem)] font-semibold leading-tight">
            Optimization tells us what can be done.
            <br />
            ML tells us what may go wrong.
          </h2>
          <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
            <div className="border border-hairline bg-snow px-4 py-3 font-sans text-[14px] font-semibold">Route plan + features</div>
            <span className="text-mute">→</span>
            <div className="bg-coral px-4 py-3 font-sans text-[14px] font-semibold">GradientBoostingClassifier</div>
            <span className="text-mute">→</span>
            <div className="border border-ink bg-snow px-4 py-3 font-sans text-[14px] font-semibold">Late-delivery risk</div>
          </div>
          <p className="mt-4 max-w-2xl font-sans text-[14px] text-mute">
            Features (repo): depot_km · window_width · demand · zone_late_rate · load_pct · seq_index (post-route).
            Pre-route triage omits sequence/load. Soft triage can prefer risky normals when capacity allows — never
            relaxes hard constraints.
          </p>
          <div className="mt-5 flex gap-3 font-sans text-[13px]">
            <span className="border border-hairline bg-snow px-3 py-2">LOW</span>
            <span className="border border-hairline bg-snow px-3 py-2">MEDIUM</span>
            <span className="border border-coral bg-[#FFF5F2] px-3 py-2 font-semibold">HIGH</span>
          </div>
          <button
            type="button"
            onClick={() => setMlOpen((v) => !v)}
            className="mt-6 border border-hairline bg-snow px-4 py-2 font-sans text-[13px] font-semibold"
          >
            {mlOpen ? "Hide" : "Show"} technical details
          </button>
          {mlOpen && (
            <div className="mt-3 max-w-xl border border-hairline bg-snow px-4 py-3 font-sans text-[13px] text-mute">
              <p>
                <span className="text-ink">Model:</span> GradientBoostingClassifier
              </p>
              <p>
                <span className="text-ink">Architecture:</span> Pre-route triage + post-route overlay
              </p>
              <p>
                <span className="text-ink">Training:</span> Synthetic historical CSV (not real telemetry)
              </p>
              <p>
                <span className="text-ink">Validation:</span> not_production_validated: true
              </p>
            </div>
          )}
        </SlideFrame>
      )}

      {/* SLIDE 7 */}
      {slide === 7 && (
        <SlideFrame>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-coral">Live demo</p>
          <h2 className="mt-2 font-sans text-[clamp(2rem,5vw,3.4rem)] font-semibold leading-tight">Let&apos;s see it work.</h2>
          <p className="mt-3 font-sans text-[16px] text-mute">
            Fresh Bengaluru synthetic scenario · real OR-Tools · real late-risk model
          </p>
          {session.summary ? (
            <div className="mt-8 flex flex-wrap gap-6 border border-hairline bg-snow px-5 py-4">
              <Stat label="Orders" value={session.summary.orders} />
              <Stat label="Vehicles" value={session.summary.vehicles} />
              <Stat label="Critical" value={session.summary.critical} />
              <Stat label="Demand" value={session.summary.total_demand} />
            </div>
          ) : (
            <p className="mt-6 font-sans text-[14px] text-mute">
              No Lab scenario in this browser session yet — generate one with <strong>Synthetic day</strong> in the Lab.
            </p>
          )}
          <button type="button" onClick={openLab} className="mt-10 bg-coral px-10 py-5 font-sans text-[18px] font-semibold">
            Open Optimizer Lab →
          </button>
          <p className="mt-4 font-mono text-[11px] text-mute">Returns here at slide 07 after you click ← Back to Presentation</p>
        </SlideFrame>
      )}

      {/* SLIDE 8 */}
      {slide === 8 && (
        <SlideFrame>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-coral">Disruption</p>
          <h2 className="mt-2 font-sans text-[clamp(1.7rem,4vw,2.6rem)] font-semibold">
            What happens when the plan changes?
          </h2>
          <div className="mt-8 flex max-w-lg flex-col gap-2">
            {[
              "Optimized plan",
              `⚠ Vehicle ${session.disruption?.vehicle_id ?? "unavailable"}`,
              `Affected deliveries${session.disruption ? ` · ${session.disruption.affected_orders}` : ""}`,
              "Nexus reoptimizes",
              "New feasible plan",
            ].map((label, i) => (
              <div
                key={label}
                className={`border px-4 py-3 font-sans text-[15px] ${
                  disruptStep >= i ? "border-coral bg-[#FFF5F2]" : "border-hairline bg-snow opacity-45"
                }`}
              >
                {label}
              </div>
            ))}
          </div>
          {session.disruption && (
            <p className="mt-4 font-mono text-[12px] text-mute">
              Late {session.disruption.before_late} → {session.disruption.after_late} · km{" "}
              {session.disruption.before_distance_km} → {session.disruption.after_distance_km}
            </p>
          )}
          {!session.disruption && (
            <p className="mt-4 font-sans text-[14px] text-mute">
              Conceptual story — run Optimize in the Lab, then return (holds/re-solve demonstrate replanning).
            </p>
          )}
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setDisruptStep((s) => (s >= 4 ? 0 : s + 1))}
              className="bg-coral px-5 py-3 font-sans text-[14px] font-semibold"
            >
              Replay
            </button>
            <button type="button" onClick={openLab} className="border border-hairline bg-snow px-5 py-3 font-sans text-[14px] font-semibold">
              Open Lab
            </button>
          </div>
        </SlideFrame>
      )}

      {/* SLIDE 9 */}
      {slide === 9 && (
        <SlideFrame>
          <h2 className="font-sans text-[clamp(1.7rem,4vw,2.6rem)] font-semibold">From routes to better decisions.</h2>
          <ul className="mt-6 space-y-2 font-sans text-[16px]">
            <li>✓ Constraint-aware routing (CVRPTW)</li>
            <li>✓ Vehicle-capacity + time-window handling</li>
            <li>✓ Late-delivery risk prediction (Gradient Boosting)</li>
            <li>✓ Re-planning when the day changes</li>
          </ul>
          {session.metrics ? (
            <div className="mt-8 max-w-lg border border-hairline bg-snow p-5">
              <p className="font-mono text-[11px] uppercase tracking-wide text-mute">Latest demo result (this session)</p>
              <div className="mt-3 grid grid-cols-2 gap-3 font-sans text-[14px]">
                <p>
                  Distance <span className="font-semibold">{session.metrics.nexus.distance_km} km</span>
                </p>
                <p>
                  Late <span className="font-semibold">{session.metrics.nexus.late_count}</span>
                </p>
                <p>
                  Breaches <span className="font-semibold">{session.metrics.nexus.hard_breaches}</span>
                </p>
                <p>
                  Deferred <span className="font-semibold">{session.metrics.nexus.unassigned_count}</span>
                </p>
              </div>
              <p className="mt-2 font-mono text-[10px] text-mute">
                Baseline late {session.metrics.before.late_count} → Nexus {session.metrics.nexus.late_count}
                {session.metrics.nexus.partial ? " · partial" : ""}
              </p>
            </div>
          ) : (
            <p className="mt-6 font-sans text-[14px] text-mute">Run Compare / Smart in the Optimizer Lab to capture measured results here.</p>
          )}
          <div className="mt-12">
            <h1 className="font-sans text-[clamp(2rem,6vw,3.4rem)] font-semibold">NEXUS LOGISTICS</h1>
            <p className="mt-2 font-sans text-[18px] text-mute">Smarter routes. Fewer delays. Better decisions.</p>
            <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-mute">
              Avishkara&apos;26 · JP-019 · Code with Errors
            </p>
            <p className="mt-1 font-sans text-[14px]">Naga Shreeshyl K S · Nivetha · Ankitha · Skanda</p>
            <p className="mt-10 font-sans text-[24px] font-semibold text-coral">Thank you</p>
          </div>
        </SlideFrame>
      )}

      {overview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/40 p-4" onClick={() => setOverview(false)}>
          <div className="grid w-full max-w-2xl grid-cols-3 gap-2 border border-ink bg-snow p-4" onClick={(e) => e.stopPropagation()}>
            {SLIDE_TITLES.map((t, i) => (
              <button
                key={t}
                type="button"
                onClick={() => go(i + 1)}
                className={`border p-3 text-left font-sans text-[13px] ${slide === i + 1 ? "border-coral bg-[#FFF5F2]" : "border-hairline"}`}
              >
                <span className="font-mono text-[10px] text-mute">{String(i + 1).padStart(2, "0")}</span>
                <br />
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {techOpen && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-ink/40 p-4 sm:items-center" onClick={() => setTechOpen(false)}>
          <div className="max-h-[85dvh] w-full max-w-lg overflow-y-auto border border-ink bg-snow p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-sans text-[16px] font-semibold">Technical details</h3>
              <button type="button" className="underline" onClick={() => setTechOpen(false)}>
                Close
              </button>
            </div>
            <dl className="mt-4 space-y-3 font-sans text-[13px]">
              <TechRow k="Problem" v="CVRPTW" />
              <TechRow k="Solver" v="Google OR-Tools 9.11" />
              <TechRow k="First solution" v="PATH_CHEAPEST_ARC" />
              <TechRow k="Local search" v="GUIDED_LOCAL_SEARCH" />
              <TechRow k="ML" v="GradientBoostingClassifier (pre-route + post-route)" />
              <TechRow k="Routing" v="OSRM + Haversine fallback" />
              <TechRow k="Backend" v="FastAPI / Python / Pydantic" />
              <TechRow k="Frontend" v="React / Vite / TypeScript / Leaflet" />
              <TechRow k="Data" v="Firestore + SQLite Lab + CSV history" />
              <TechRow k="LLM" v="None — no external generative AI API" />
            </dl>
          </div>
        </div>
      )}

      <footer className="fixed bottom-0 left-0 right-0 flex items-center justify-between border-t border-hairline bg-snow/95 px-5 py-3 backdrop-blur md:px-8">
        <button
          type="button"
          disabled={slide <= 1}
          onClick={() => go(slide - 1)}
          className="font-sans text-[13px] font-semibold text-mute disabled:opacity-30 hover:text-ink"
        >
          ← Prev
        </button>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: TOTAL }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Slide ${i + 1}`}
              onClick={() => go(i + 1)}
              className={`h-1.5 w-4 ${slide === i + 1 ? "bg-coral" : "bg-hairline"}`}
            />
          ))}
          <span className="ml-3 font-mono text-[11px] tabular text-mute">
            {String(slide).padStart(2, "0")} / {String(TOTAL).padStart(2, "0")}
          </span>
        </div>
        <button
          type="button"
          disabled={slide >= TOTAL}
          onClick={() => go(slide + 1)}
          className="font-sans text-[13px] font-semibold text-mute disabled:opacity-30 hover:text-ink"
        >
          Next →
        </button>
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase text-mute">{label}</p>
      <p className="font-sans text-[22px] font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function TechRow({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-wide text-mute">{k}</dt>
      <dd className="mt-0.5 text-ink">{v}</dd>
    </div>
  );
}
