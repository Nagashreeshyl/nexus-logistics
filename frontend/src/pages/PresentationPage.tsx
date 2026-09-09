import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  MapPin,
  Package,
  Route,
  ShieldAlert,
  Sparkles,
  Truck,
  Zap,
} from "lucide-react";
import { readLabSession } from "../lib/labSession";
import { TechStackCards } from "../components/TechStackCards";

const TOTAL = 6;

const SLIDE_TITLES = [
  "Team · JP-019",
  "The problem",
  "Our solution",
  "Tech stack",
  "See the Lab",
  "Thank you",
];

const TEAM = [
  {
    name: "Naga Shreeshyl K S",
    role: "Team Leader · Developer",
    accent: "#E85D3B",
    blurb: "Leads build of Nexus — optimizer Lab, APIs, and live demo path.",
  },
  {
    name: "Nivetha",
    role: "Research · Presenter",
    accent: "#2563EB",
    blurb: "Research on JP-019 constraints and presents the problem story.",
  },
  {
    name: "Ankitha",
    role: "Research · Presenter",
    accent: "#6B4E9B",
    blurb: "Research on late-risk and presents the ML advisory story.",
  },
  {
    name: "Skanda",
    role: "Tester",
    accent: "#2F6F5E",
    blurb: "Tests Lab flows — Load, Optimize, Plan, Risk, and Exports.",
  },
];

const PAINS = [
  {
    id: "fleet",
    icon: <Truck size={18} />,
    title: "Limited vans",
    body: "4–6 vehicles must cover the whole same-day book.",
    accent: "#C45C26",
  },
  {
    id: "windows",
    icon: <Clock3 size={18} />,
    title: "Tight windows",
    body: "Customers only accept during short slots like 11:00–13:00.",
    accent: "#1F7A8C",
  },
  {
    id: "critical",
    icon: <Package size={18} />,
    title: "Critical orders",
    body: "Medicine and same-day promises cannot slip.",
    accent: "#E85D3B",
  },
  {
    id: "late",
    icon: <AlertTriangle size={18} />,
    title: "Late risk",
    body: "Nearest-next looks short — then capacity breaks and lateness piles up.",
    accent: "#6B4E9B",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Build routes",
    body: "OR-Tools assigns stops under hard capacity and time windows.",
    accent: "#E85D3B",
    icon: <Route size={20} />,
  },
  {
    n: "02",
    title: "Warn late risk",
    body: "ML highlights stops that may still go late — advisory only.",
    accent: "#6B4E9B",
    icon: <ShieldAlert size={20} />,
  },
  {
    n: "03",
    title: "Prove it",
    body: "Same-day Baseline vs Nexus: late, km, on-time % — measured.",
    accent: "#2F6F5E",
    icon: <Zap size={20} />,
  },
];

const LAB_STEPS = [
  { label: "Overview", hint: "Big picture", to: "/optimizer", accent: "#E85D3B" },
  { label: "Scenario", hint: "Load the day", to: "/optimizer/scenario", accent: "#C45C26" },
  { label: "Plan", hint: "Side-by-side maps", to: "/optimizer/plan", accent: "#1F7A8C" },
  { label: "Risk", hint: "Likely late stops", to: "/optimizer/risk", accent: "#6B4E9B" },
  { label: "Analytics", hint: "Live graphs", to: "/optimizer/analytics", accent: "#2F6F5E" },
  { label: "Exports", hint: "Then return here", to: "/optimizer/exports", accent: "#8B6914" },
];

function SlideFrame({
  children,
  className = "",
  wash,
}: {
  children: ReactNode;
  className?: string;
  wash?: string;
}) {
  return (
    <div className="relative min-h-[calc(100dvh-120px)] overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            wash ??
            "radial-gradient(ellipse 80% 50% at 10% -10%, rgba(244,124,89,0.18), transparent 55%), radial-gradient(ellipse 60% 40% at 95% 20%, rgba(146,207,242,0.22), transparent 50%)",
        }}
      />
      <div
        className={`relative mx-auto flex min-h-[calc(100dvh-120px)] w-full max-w-5xl flex-col justify-center px-6 py-10 pb-24 md:px-12 ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

function AccentChip({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]"
      style={{ borderColor: `${color}55`, backgroundColor: `${color}14`, color }}
    >
      {children}
    </span>
  );
}

export function PresentationPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const slide = Math.min(TOTAL, Math.max(1, Number(params.get("slide") || "1") || 1));
  const [overview, setOverview] = useState(false);
  const [activePain, setActivePain] = useState(PAINS[0].id);
  const [activeStep, setActiveStep] = useState(0);
  const [activeMember, setActiveMember] = useState(0);
  const [doneSteps, setDoneSteps] = useState<Record<number, boolean>>({});
  const session = useMemo(() => readLabSession(), [slide, overview]);

  const go = useCallback(
    (n: number) => {
      setParams({ slide: String(Math.min(TOTAL, Math.max(1, n))) }, { replace: true });
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
  }, [go, slide, overview]);

  const openLab = (path = "/optimizer") => {
    navigate(
      `${path}?returnTo=${encodeURIComponent("/presentation?slide=6")}&fromSlide=6`,
    );
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) void document.documentElement.requestFullscreen();
    else void document.exitFullscreen();
  };

  const m = session.metrics;
  const pain = PAINS.find((p) => p.id === activePain) ?? PAINS[0];

  return (
    <div className="relative bg-paper text-ink">
      <div className="absolute right-4 top-4 z-20 flex gap-2">
        <button
          type="button"
          onClick={() => setOverview(true)}
          className="border border-hairline bg-snow/90 px-3 py-1.5 font-sans text-[12px] font-semibold text-mute backdrop-blur hover:border-ink hover:text-ink"
        >
          Overview
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="border border-hairline bg-snow/90 px-3 py-1.5 font-sans text-[12px] font-semibold text-mute backdrop-blur hover:border-ink hover:text-ink"
        >
          Fullscreen
        </button>
      </div>

      {/* 1 · Team — professional title slide */}
      {slide === 1 && (
        <SlideFrame
          wash="radial-gradient(ellipse 70% 45% at 100% 0%, rgba(244,124,89,0.12), transparent 55%), radial-gradient(ellipse 50% 40% at 0% 100%, rgba(146,207,242,0.1), transparent 50%)"
        >
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-mute">
            Avishkara&apos;26 · JP-019
          </p>
          <h1 className="mt-6 font-sans text-[clamp(2.6rem,8vw,4.75rem)] font-semibold leading-[0.92] tracking-tight text-ink">
            NEXUS
            <br />
            <span className="text-coral">LOGISTICS</span>
          </h1>
          <p className="mt-5 max-w-lg font-sans text-[17px] leading-snug text-mute">
            Last-Mile Delivery Route Optimizer &amp; Late-Delivery Risk Predictor
          </p>

          <div className="mt-10">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-mute">
                Team · Code with Errors
              </p>
              <p className="font-sans text-[12px] text-mute">Tap a card</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {TEAM.map((member, i) => {
                const on = activeMember === i;
                return (
                  <button
                    key={member.name}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setActiveMember(i)}
                    className={`group flex h-full flex-col border bg-snow p-4 text-left transition duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral ${
                      on
                        ? "-translate-y-1 border-ink shadow-[0_12px_28px_rgba(26,26,26,0.1)]"
                        : "border-hairline hover:-translate-y-0.5 hover:border-ink/40"
                    }`}
                    style={{ borderTopWidth: 3, borderTopColor: member.accent }}
                  >
                    <span
                      className="inline-flex h-9 w-9 items-center justify-center font-sans text-[13px] font-semibold text-ink"
                      style={{ backgroundColor: `${member.accent}22` }}
                      aria-hidden
                    >
                      {member.name
                        .split(" ")
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((w) => w[0])
                        .join("")
                        .toUpperCase()}
                    </span>
                    <p className="mt-3 font-sans text-[15px] font-semibold leading-snug text-ink">{member.name}</p>
                    <p
                      className="mt-1 font-mono text-[9px] font-semibold uppercase tracking-[0.12em]"
                      style={{ color: member.accent }}
                    >
                      {member.role}
                    </p>
                    <p
                      className={`mt-3 font-sans text-[12px] leading-snug text-mute transition ${
                        on ? "opacity-100" : "opacity-70"
                      }`}
                    >
                      {member.blurb}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => go(2)}
              className="inline-flex items-center gap-2 bg-ink px-6 py-3 font-sans text-[14px] font-semibold text-snow transition hover:bg-ink/90"
            >
              Begin <ArrowRight size={16} />
            </button>
            <p className="font-sans text-[13px] text-mute">or press → / Space</p>
          </div>
        </SlideFrame>
      )}

      {/* 2 · Problem */}
      {slide === 2 && (
        <SlideFrame
          wash="radial-gradient(ellipse 70% 50% at 90% 0%, rgba(244,124,89,0.2), transparent 55%), radial-gradient(ellipse 50% 40% at 0% 60%, rgba(107,78,155,0.12), transparent 50%)"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-coral">The problem</p>
          <h2 className="mt-2 font-sans text-[clamp(1.7rem,4vw,2.5rem)] font-semibold leading-tight">
            Last-mile is hard for a reason
          </h2>
          <p className="mt-3 max-w-2xl font-sans text-[15px] text-mute">
            Tap a pressure point — then read the Bengaluru same-day example.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PAINS.map((p) => {
              const on = activePain === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActivePain(p.id)}
                  className={`border bg-snow p-3 text-left transition duration-250 ${
                    on ? "-translate-y-1 border-ink shadow-[0_10px_24px_rgba(26,26,26,0.1)]" : "border-hairline hover:border-ink/40"
                  }`}
                  style={{ borderTopWidth: 3, borderTopColor: p.accent }}
                >
                  <span
                    className="inline-flex h-8 w-8 items-center justify-center"
                    style={{ backgroundColor: `${p.accent}18`, color: p.accent }}
                  >
                    {p.icon}
                  </span>
                  <p className="mt-2 font-sans text-[14px] font-semibold">{p.title}</p>
                </button>
              );
            })}
          </div>

          <div
            className="mt-4 border bg-snow px-5 py-4 transition"
            style={{ borderColor: `${pain.accent}66`, borderLeftWidth: 4, borderLeftColor: pain.accent }}
          >
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: pain.accent }}>
              {pain.title}
            </p>
            <p className="mt-2 font-sans text-[15px] text-ink">{pain.body}</p>
          </div>

          <div className="mt-4 flex gap-3 border border-ink bg-gradient-to-br from-[#FFF5F2] to-[#EEF7FB] px-5 py-4">
            <MapPin className="mt-0.5 shrink-0 text-coral" size={18} />
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-mute">
                Real-world · Bengaluru same-day
              </p>
              <p className="mt-2 font-sans text-[14px] leading-relaxed text-ink">
                20+ stops across Koramangala, Indiranagar, JP Nagar · 4–6 vans · critical medicine / same-day · windows
                like 11:00–13:00. Nearest-next looks short — then capacity breaks and late deliveries pile up.
              </p>
            </div>
          </div>
        </SlideFrame>
      )}

      {/* 3 · Solution */}
      {slide === 3 && (
        <SlideFrame
          wash="radial-gradient(ellipse 60% 45% at 0% 0%, rgba(47,111,94,0.14), transparent 50%), radial-gradient(ellipse 55% 40% at 100% 30%, rgba(244,124,89,0.16), transparent 55%)"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-coral">Our solution</p>
          <h2 className="mt-2 font-sans text-[clamp(1.7rem,4vw,2.5rem)] font-semibold leading-tight">
            Feasible routes · late warnings · honest compare
          </h2>

          <div className="mt-7 grid gap-3 md:grid-cols-3">
            {STEPS.map((s, i) => {
              const on = activeStep === i;
              return (
                <button
                  key={s.n}
                  type="button"
                  onClick={() => setActiveStep(i)}
                  onMouseEnter={() => setActiveStep(i)}
                  className={`relative overflow-hidden border bg-snow p-4 text-left transition duration-300 ${
                    on ? "-translate-y-1 border-ink shadow-[0_14px_30px_rgba(26,26,26,0.12)]" : "border-hairline"
                  }`}
                  style={{ borderTopWidth: 3, borderTopColor: s.accent }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="inline-flex h-10 w-10 items-center justify-center text-ink"
                      style={{ backgroundColor: `${s.accent}20` }}
                    >
                      {s.icon}
                    </span>
                    <span className="font-mono text-[18px] font-semibold" style={{ color: s.accent }}>
                      {s.n}
                    </span>
                  </div>
                  <p className="mt-3 font-sans text-[16px] font-semibold">{s.title}</p>
                  <p
                    className={`mt-2 font-sans text-[13px] leading-snug text-mute transition ${
                      on ? "opacity-100" : "opacity-70"
                    }`}
                  >
                    {s.body}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex items-start gap-3 border border-hairline bg-snow px-4 py-3">
            <Sparkles className="mt-0.5 shrink-0 text-coral" size={16} />
            <p className="font-sans text-[14px] text-ink">
              If the day cannot fit, Nexus returns a <span className="font-semibold text-coral">partial plan</span> and
              lists deferred stops — we never fake full success.
            </p>
          </div>
        </SlideFrame>
      )}

      {/* 4 · Tech cards */}
      {slide === 4 && (
        <SlideFrame className="justify-start pt-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-coral">Tech stack</p>
          <h2 className="mt-2 font-sans text-[clamp(1.6rem,4vw,2.4rem)] font-semibold">
            What we used — and why
          </h2>
          <p className="mt-2 font-sans text-[14px] text-mute">Tap a card to flip. Drag the grip to reorder.</p>
          <div className="mt-6">
            <TechStackCards />
          </div>
        </SlideFrame>
      )}

      {/* 5 · Lab CTA */}
      {slide === 5 && (
        <SlideFrame
          wash="radial-gradient(ellipse 70% 50% at 50% -10%, rgba(244,124,89,0.22), transparent 55%), radial-gradient(ellipse 40% 35% at 100% 80%, rgba(146,207,242,0.25), transparent 50%)"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-coral">Live demo</p>
          <h2 className="mt-2 font-sans text-[clamp(1.7rem,4vw,2.5rem)] font-semibold leading-tight">
            Open the Lab — prove it live
          </h2>
          <p className="mt-3 max-w-2xl font-sans text-[15px] text-mute">
            Synthetic Bengaluru data (JP-019 allowed). Solvers and risk scores run for real. Tap a step to mark it, or
            jump straight in.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LAB_STEPS.map((s, i) => {
              const done = Boolean(doneSteps[i]);
              return (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => {
                    setDoneSteps((m) => ({ ...m, [i]: !m[i] }));
                  }}
                  onDoubleClick={() => openLab(s.to)}
                  className={`group relative overflow-hidden border bg-snow p-4 text-left transition duration-250 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(26,26,26,0.1)] ${
                    done ? "border-ink" : "border-hairline"
                  }`}
                  style={{ borderTopWidth: 3, borderTopColor: s.accent }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-semibold" style={{ color: s.accent }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {done ? (
                      <CheckCircle2 size={16} style={{ color: s.accent }} />
                    ) : (
                      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-mute opacity-0 transition group-hover:opacity-100">
                        mark · dbl-click open
                      </span>
                    )}
                  </div>
                  <p className="mt-2 font-sans text-[15px] font-semibold">{s.label}</p>
                  <p className="mt-1 font-sans text-[12px] text-mute">{s.hint}</p>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => openLab("/optimizer")}
            className="mt-8 inline-flex items-center gap-2 bg-coral px-8 py-4 font-sans text-[16px] font-semibold text-ink shadow-[0_12px_28px_rgba(244,124,89,0.35)] transition hover:brightness-105"
          >
            Open Lab · Overview <ArrowRight size={18} />
          </button>
        </SlideFrame>
      )}

      {/* 6 · Thank you */}
      {slide === 6 && (
        <SlideFrame
          wash="radial-gradient(ellipse 80% 55% at 50% 0%, rgba(244,124,89,0.25), transparent 60%), radial-gradient(ellipse 50% 40% at 0% 100%, rgba(146,207,242,0.2), transparent 50%)"
        >
          <AccentChip color="#E85D3B">Close</AccentChip>
          <h2 className="mt-4 font-sans text-[clamp(2.4rem,7vw,4rem)] font-semibold tracking-tight">
            Thank <span className="text-coral">you</span>
          </h2>
          <p className="mt-3 max-w-xl font-sans text-[16px] text-mute">
            Nexus Logistics · Team Code with Errors · Avishkara&apos;26 · JP-019
          </p>

          {m ? (
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: "Late",
                  value: `${m.before.late_count} → ${m.nexus.late_count}`,
                  accent: "#E85D3B",
                },
                {
                  label: "Distance km",
                  value: `${m.before.distance_km.toFixed(1)} → ${m.nexus.distance_km.toFixed(1)}`,
                  accent: "#1F7A8C",
                },
                {
                  label: "Travel",
                  value: m.travel_source || "—",
                  accent: "#2F6F5E",
                },
              ].map((card) => (
                <article
                  key={card.label}
                  className="border border-hairline bg-snow p-4 transition hover:-translate-y-0.5 hover:border-ink"
                  style={{ borderTopWidth: 3, borderTopColor: card.accent }}
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-mute">{card.label}</p>
                  <p className="mt-2 font-sans text-[20px] font-semibold tabular">{card.value}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-8 border border-dashed border-hairline bg-snow/80 px-4 py-5 font-sans text-[14px] text-mute">
              Run Optimize in the Lab to surface live measured deltas here.
            </p>
          )}

          <details className="mt-6 max-w-xl border border-hairline bg-snow open:border-ink">
            <summary className="cursor-pointer px-4 py-3 font-sans text-[13px] font-semibold text-ink">
              Honest limits
            </summary>
            <p className="border-t border-hairline px-4 py-3 font-sans text-[13px] text-mute">
              Synthetic demo scenarios · ML not production-validated · optimizer is time-limited (feasible ≠ globally
              optimal) · travel may use Haversine when roads are unavailable.
            </p>
          </details>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => openLab("/optimizer")}
              className="bg-coral px-6 py-3 font-sans text-[14px] font-semibold shadow-[0_10px_24px_rgba(244,124,89,0.3)]"
            >
              Back to Lab
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className="border border-ink bg-snow px-6 py-3 font-sans text-[14px] font-semibold hover:bg-paper"
            >
              Restart deck
            </button>
          </div>
        </SlideFrame>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-hairline bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <button
            type="button"
            disabled={slide <= 1}
            onClick={() => go(slide - 1)}
            className="min-w-[5.5rem] border border-hairline bg-snow px-4 py-2 font-sans text-[13px] font-semibold disabled:opacity-30"
          >
            ← Prev
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate font-mono text-[11px] text-mute">
              {slide}/{TOTAL} · {SLIDE_TITLES[slide - 1]}
            </p>
            <div className="mx-auto mt-1.5 flex max-w-xs justify-center gap-1">
              {Array.from({ length: TOTAL }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Slide ${i + 1}`}
                  onClick={() => go(i + 1)}
                  className={`h-1.5 flex-1 max-w-8 transition ${i + 1 === slide ? "bg-coral" : "bg-hairline hover:bg-mute"}`}
                />
              ))}
            </div>
          </div>
          <button
            type="button"
            disabled={slide >= TOTAL}
            onClick={() => go(slide + 1)}
            className="min-w-[5.5rem] border border-ink bg-snow px-4 py-2 font-sans text-[13px] font-semibold disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      </div>

      {overview && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4" onClick={() => setOverview(false)}>
          <div
            className="max-h-[85dvh] w-full max-w-lg overflow-y-auto border border-ink bg-paper p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="font-sans text-[16px] font-semibold">Slides</p>
              <button type="button" className="text-[13px] text-mute underline" onClick={() => setOverview(false)}>
                Close
              </button>
            </div>
            <div className="mt-3 grid gap-2">
              {SLIDE_TITLES.map((title, i) => (
                <button
                  key={title}
                  type="button"
                  onClick={() => go(i + 1)}
                  className={`border px-3 py-2 text-left font-sans text-[13px] transition hover:-translate-y-0.5 ${
                    slide === i + 1 ? "border-coral bg-[#FFF5F2]" : "border-hairline bg-snow"
                  }`}
                >
                  <span className="font-mono text-[10px] text-mute">{i + 1}</span> {title}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
