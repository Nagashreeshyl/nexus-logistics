import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { readLabSession } from "../lib/labSession";

const TOTAL = 9;

function SlideFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`mx-auto flex min-h-[calc(100dvh-65px)] w-full max-w-6xl flex-col justify-center px-6 py-10 md:px-12 ${className}`}
      style={{ aspectRatio: "auto" }}
    >
      {children}
    </div>
  );
}

function PipelineStep({ label, delay }: { label: string; delay: number }) {
  return (
    <div
      className="border border-white/15 bg-white/[0.03] px-4 py-3 font-sans text-[15px] font-semibold text-[#f2efe8] opacity-0 animate-[fadeUp_0.5s_ease_forwards]"
      style={{ animationDelay: `${delay}ms` }}
    >
      {label}
    </div>
  );
}

export function PresentationPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const slide = Math.min(TOTAL, Math.max(1, Number(params.get("slide") || "1") || 1));
  const [techOpen, setTechOpen] = useState(false);
  const session = useMemo(() => readLabSession(), [slide]);

  const go = useCallback(
    (n: number) => {
      const next = Math.min(TOTAL, Math.max(1, n));
      setParams({ slide: String(next) }, { replace: true });
    },
    [setParams],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
      } else if (e.key === "Escape") {
        setTechOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, slide]);

  const openLab = () => {
    navigate(`/optimizer?returnTo=${encodeURIComponent(`/presentation?slide=${slide}`)}&fromSlide=${slide}`);
  };

  return (
    <div className="relative bg-[#0c0d10] text-[#f2efe8]">
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        @keyframes softIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      {slide === 1 && (
        <SlideFrame>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#8b909a] opacity-0 animate-[softIn_0.8s_ease_forwards]">
            Avishkara&apos;26 · JP-019
          </p>
          <h1 className="mt-4 font-sans text-[clamp(2.8rem,9vw,5.5rem)] font-semibold leading-[0.92] tracking-tight opacity-0 animate-[fadeUp_0.7s_ease_forwards]">
            NEXUS LOGISTICS
          </h1>
          <p className="mt-5 max-w-2xl font-sans text-[clamp(1.05rem,2.2vw,1.35rem)] text-[#c5c8cf] opacity-0 animate-[fadeUp_0.7s_ease_0.15s_forwards]">
            Last-Mile Delivery Route Optimizer
            <br />
            &amp; Late-Delivery Risk Predictor
          </p>
          <div className="mt-10 space-y-1 font-mono text-[12px] uppercase tracking-[0.14em] text-[#8b909a] opacity-0 animate-[fadeUp_0.7s_ease_0.3s_forwards]">
            <p>Code with Errors</p>
            <p className="normal-case tracking-normal text-[#c5c8cf]">
              Naga Shreeshyl K S · Nivetha · Ankitha · Skanda
            </p>
          </div>
          <button
            type="button"
            onClick={() => go(2)}
            className="mt-12 w-fit bg-[#f47c59] px-8 py-3.5 font-sans text-[14px] font-semibold text-[#0c0d10] opacity-0 animate-[fadeUp_0.7s_ease_0.45s_forwards]"
          >
            Start
          </button>
        </SlideFrame>
      )}

      {slide === 2 && (
        <SlideFrame>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#f47c59]">The Problem</p>
          <h2 className="mt-3 font-sans text-[clamp(2rem,5vw,3.2rem)] font-semibold leading-tight">
            Manual last-mile planning breaks under real constraints.
          </h2>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              "Many deliveries",
              "Limited vehicles",
              "Different capacities",
              "Different time windows",
              "Unexpected delays",
            ].map((t, i) => (
              <PipelineStep key={t} label={t} delay={i * 90} />
            ))}
          </div>
          <p className="mt-8 font-sans text-[18px] text-[#c5c8cf]">↓ Manual planning becomes difficult.</p>
        </SlideFrame>
      )}

      {slide === 3 && (
        <SlideFrame>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#f47c59]">Our Solution</p>
          <div className="mt-8 flex flex-col items-start gap-4 md:flex-row md:items-center md:gap-6">
            <div className="space-y-2">
              {["Orders", "Fleet", "Constraints"].map((t) => (
                <div key={t} className="border border-white/15 px-4 py-2 font-sans text-[16px] font-semibold">
                  {t}
                </div>
              ))}
            </div>
            <span className="font-mono text-[#8b909a]">→</span>
            <div className="bg-[#f47c59] px-6 py-4 font-sans text-[20px] font-semibold text-[#0c0d10]">NEXUS</div>
            <span className="font-mono text-[#8b909a]">→</span>
            <div className="border border-[#92cff2]/50 px-5 py-4 font-sans text-[16px] font-semibold text-[#92cff2]">
              Optimized delivery plan
            </div>
          </div>
          <p className="mt-10 max-w-2xl font-sans text-[17px] leading-relaxed text-[#c5c8cf]">
            Nexus generates feasible and efficient delivery routes while considering real operational constraints.
          </p>
        </SlideFrame>
      )}

      {slide === 4 && (
        <SlideFrame>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#f47c59]">How It Works</p>
          <h2 className="mt-3 font-sans text-[clamp(2rem,5vw,3rem)] font-semibold">A clear pipeline</h2>
          <div className="mt-10 flex max-w-lg flex-col gap-2">
            {[
              "Delivery data",
              "Route optimization",
              "Late-risk prediction",
              "Delivery plan",
            ].map((t, i) => (
              <div key={t} className="flex items-center gap-3">
                <span className="font-mono text-[12px] text-[#8b909a]">{String(i + 1).padStart(2, "0")}</span>
                <PipelineStep label={t} delay={i * 120} />
              </div>
            ))}
          </div>
        </SlideFrame>
      )}

      {slide === 5 && (
        <SlideFrame>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#f47c59]">Technology</p>
          <h2 className="mt-3 font-sans text-[clamp(2rem,5vw,3rem)] font-semibold">Repository-confirmed stack</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="border border-white/12 p-5">
              <p className="font-mono text-[11px] uppercase tracking-wider text-[#8b909a]">Route optimization</p>
              <p className="mt-2 font-sans text-[22px] font-semibold">CVRPTW</p>
              <p className="mt-1 text-[15px] text-[#c5c8cf]">Google OR-Tools · hard capacity + time windows</p>
            </div>
            <div className="border border-white/12 p-5">
              <p className="font-mono text-[11px] uppercase tracking-wider text-[#8b909a]">Late-delivery risk</p>
              <p className="mt-2 font-sans text-[22px] font-semibold">Gradient Boosting Classifier</p>
              <p className="mt-1 text-[15px] text-[#c5c8cf]">sklearn · advisory triage / risk overlay</p>
            </div>
            <div className="border border-white/12 p-5">
              <p className="font-mono text-[11px] uppercase tracking-wider text-[#8b909a]">App stack</p>
              <p className="mt-2 text-[15px] text-[#c5c8cf]">
                React / Vite · FastAPI · Firestore + SQLite · OSRM with haversine fallback
              </p>
            </div>
            <div className="border border-white/12 p-5">
              <p className="font-mono text-[11px] uppercase tracking-wider text-[#8b909a]">Not used</p>
              <p className="mt-2 text-[15px] text-[#c5c8cf]">
                No Gemini / OpenAI / Grok / Claude. No external LLM API.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTechOpen(true)}
            className="mt-8 border border-white/20 px-4 py-2 font-sans text-[13px] font-semibold text-[#c5c8cf] hover:text-white"
          >
            Technical Details
          </button>
        </SlideFrame>
      )}

      {slide === 6 && (
        <SlideFrame>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#f47c59]">Why Nexus?</p>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="border border-white/10 p-6">
              <p className="font-mono text-[11px] uppercase tracking-wider text-[#8b909a]">Before</p>
              <h3 className="mt-2 font-sans text-[22px] font-semibold">Manual / basic planning</h3>
              <ul className="mt-4 space-y-2 font-sans text-[15px] text-[#c5c8cf]">
                <li>→ Inefficient routing</li>
                <li>→ Difficult constraint handling</li>
                <li>→ Difficult replanning</li>
                <li>→ Possible late deliveries</li>
              </ul>
            </div>
            <div className="border border-[#f47c59]/40 bg-[#f47c59]/5 p-6">
              <p className="font-mono text-[11px] uppercase tracking-wider text-[#f47c59]">Nexus</p>
              <h3 className="mt-2 font-sans text-[22px] font-semibold">Constraint-aware optimization</h3>
              <ul className="mt-4 space-y-2 font-sans text-[15px] text-[#c5c8cf]">
                <li>→ Considers capacity &amp; windows</li>
                <li>→ Optimizes routes (OR-Tools)</li>
                <li>→ Predicts late risk (ML)</li>
                <li>→ Re-optimizes after disruption</li>
              </ul>
            </div>
          </div>
        </SlideFrame>
      )}

      {slide === 7 && (
        <SlideFrame>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#f47c59]">Live Demo</p>
          <h2 className="mt-3 font-sans text-[clamp(2.2rem,6vw,3.8rem)] font-semibold leading-tight">
            Open the Optimizer Lab
          </h2>
          <p className="mt-4 max-w-xl font-sans text-[16px] text-[#c5c8cf]">
            Load a fresh synthetic Bengaluru scenario, run the real optimizer, then return here to continue.
          </p>
          <button
            type="button"
            onClick={openLab}
            className="mt-12 bg-[#f47c59] px-10 py-5 font-sans text-[18px] font-semibold text-[#0c0d10] transition hover:brightness-110"
          >
            Open Optimizer Lab →
          </button>
        </SlideFrame>
      )}

      {slide === 8 && (
        <SlideFrame>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#f47c59]">Result / Impact</p>
          <h2 className="mt-3 font-sans text-[clamp(2rem,5vw,3rem)] font-semibold">Latest Lab run</h2>
          {session.metrics ? (
            <div className="mt-8 overflow-x-auto">
              <table className="w-full max-w-2xl border-collapse text-left font-sans text-[15px]">
                <thead>
                  <tr className="border-b border-white/15 text-[#8b909a]">
                    <th className="py-2 pr-4 font-medium">Metric</th>
                    <th className="py-2 pr-4 font-medium">Before</th>
                    <th className="py-2 font-medium text-[#f47c59]">Nexus</th>
                  </tr>
                </thead>
                <tbody className="text-[#c5c8cf]">
                  <tr className="border-b border-white/8">
                    <td className="py-3 pr-4">Distance (km)</td>
                    <td className="py-3 pr-4 tabular">{session.metrics.before.distance_km}</td>
                    <td className="py-3 tabular text-[#f2efe8]">{session.metrics.nexus.distance_km}</td>
                  </tr>
                  <tr className="border-b border-white/8">
                    <td className="py-3 pr-4">Late deliveries</td>
                    <td className="py-3 pr-4 tabular">{session.metrics.before.late_count}</td>
                    <td className="py-3 tabular text-[#f2efe8]">{session.metrics.nexus.late_count}</td>
                  </tr>
                  <tr className="border-b border-white/8">
                    <td className="py-3 pr-4">Hard breaches</td>
                    <td className="py-3 pr-4 tabular">{session.metrics.before.hard_breaches}</td>
                    <td className="py-3 tabular text-[#f2efe8]">{session.metrics.nexus.hard_breaches}</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4">Deferred orders</td>
                    <td className="py-3 pr-4 tabular">{session.metrics.before.unassigned_count}</td>
                    <td className="py-3 tabular text-[#f2efe8]">{session.metrics.nexus.unassigned_count}</td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-4 font-mono text-[11px] text-[#8b909a]">
                From Optimizer Lab · {session.metrics.updatedAt}
                {session.metrics.nexus.partial ? " · partial plan" : ""}
                {!session.metrics.nexus.feasible ? " · infeasible under hard constraints" : ""}
              </p>
            </div>
          ) : (
            <div className="mt-8 max-w-xl space-y-3 font-sans text-[16px] text-[#c5c8cf]">
              <p>No Lab run in this browser session yet.</p>
              <p>Conceptual benefits: constraint-feasible routes, late-risk visibility, and re-planning after disruption.</p>
              <button
                type="button"
                onClick={openLab}
                className="mt-4 border border-white/20 px-4 py-2 text-[13px] font-semibold text-[#f2efe8]"
              >
                Run Optimizer Lab to capture metrics
              </button>
            </div>
          )}
        </SlideFrame>
      )}

      {slide === 9 && (
        <SlideFrame>
          <h1 className="font-sans text-[clamp(2.5rem,8vw,4.5rem)] font-semibold leading-tight">NEXUS LOGISTICS</h1>
          <p className="mt-4 font-sans text-[clamp(1.2rem,3vw,1.8rem)] text-[#c5c8cf]">
            Smarter routes.
            <br />
            Fewer delays.
            <br />
            Better decisions.
          </p>
          <div className="mt-12 space-y-2 font-mono text-[12px] uppercase tracking-[0.14em] text-[#8b909a]">
            <p>Code with Errors</p>
            <p className="normal-case tracking-normal text-[#c5c8cf]">
              Naga Shreeshyl K S · Nivetha · Ankitha · Skanda
            </p>
          </div>
          <p className="mt-16 font-sans text-[28px] font-semibold text-[#f47c59]">Thank you</p>
        </SlideFrame>
      )}

      <footer className="fixed bottom-0 left-0 right-0 flex items-center justify-between border-t border-white/10 bg-[#0c0d10]/90 px-5 py-3 backdrop-blur md:px-8">
        <button
          type="button"
          disabled={slide <= 1}
          onClick={() => go(slide - 1)}
          className="font-sans text-[13px] font-semibold text-[#c5c8cf] disabled:opacity-30"
        >
          ← Prev
        </button>
        <div className="flex items-center gap-2">
          {Array.from({ length: TOTAL }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Slide ${i + 1}`}
              onClick={() => go(i + 1)}
              className={`h-1.5 w-1.5 rounded-full ${slide === i + 1 ? "bg-[#f47c59]" : "bg-white/25"}`}
            />
          ))}
          <span className="ml-3 font-mono text-[11px] tabular text-[#8b909a]">
            {String(slide).padStart(2, "0")} / {String(TOTAL).padStart(2, "0")}
          </span>
        </div>
        <button
          type="button"
          disabled={slide >= TOTAL}
          onClick={() => go(slide + 1)}
          className="font-sans text-[13px] font-semibold text-[#c5c8cf] disabled:opacity-30"
        >
          Next →
        </button>
      </footer>

      {techOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" role="dialog">
          <div className="max-h-[85dvh] w-full max-w-lg overflow-auto border border-white/15 bg-[#14161c] p-6">
            <div className="flex items-start justify-between gap-4">
              <h3 className="font-sans text-[18px] font-semibold">Technical Details</h3>
              <button type="button" className="text-[#8b909a]" onClick={() => setTechOpen(false)}>
                Close
              </button>
            </div>
            <dl className="mt-4 space-y-3 font-sans text-[14px]">
              <div>
                <dt className="text-[#8b909a]">Algorithm</dt>
                <dd>CVRPTW · Google OR-Tools (pywrapcp)</dd>
              </div>
              <div>
                <dt className="text-[#8b909a]">ML</dt>
                <dd>GradientBoostingClassifier (sklearn) · pre-route triage + post-route overlay</dd>
              </div>
              <div>
                <dt className="text-[#8b909a]">Frontend</dt>
                <dd>React 19 · Vite 6 · TypeScript · Tailwind</dd>
              </div>
              <div>
                <dt className="text-[#8b909a]">Backend</dt>
                <dd>FastAPI · Python</dd>
              </div>
              <div>
                <dt className="text-[#8b909a]">Data</dt>
                <dd>Firestore (ops) · SQLite (classic Lab packs) · in-memory Lab synthetic</dd>
              </div>
              <div>
                <dt className="text-[#8b909a]">Routing</dt>
                <dd>OSRM table with haversine fallback</dd>
              </div>
              <div>
                <dt className="text-[#8b909a]">Realtime</dt>
                <dd>Firestore onSnapshot (ops surfaces; Lab demo is request/response)</dd>
              </div>
            </dl>
            <Link to="/optimizer" className="mt-6 inline-block text-[13px] font-semibold text-[#f47c59]">
              Open Optimizer Lab
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
