import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Ban,
  Brain,
  Database,
  GripVertical,
  Layout,
  Map,
  Navigation,
  Route,
  Server,
} from "lucide-react";

type TechCard = {
  id: string;
  layer: string;
  name: string;
  blurb: string;
  what: string;
  why: string;
  more: string;
  icon: ReactNode;
  accent: string;
};

const DEFAULT_STACK: TechCard[] = [
  {
    id: "react",
    layer: "Frontend",
    name: "React + Vite",
    blurb: "Lab screens & this deck",
    what: "Interactive UI for the Lab and deck.",
    why: "Keeps the live demo fast and clear.",
    more: "TypeScript · Tailwind · /optimizer",
    icon: <Layout size={18} strokeWidth={1.75} />,
    accent: "#E85D3B",
  },
  {
    id: "leaflet",
    layer: "Maps",
    name: "Leaflet + OSM",
    blurb: "Bengaluru routes on a map",
    what: "Draws vans, stops, and play motion.",
    why: "Visualization only — no GPS needed.",
    more: "Baseline vs Nexus · risk markers",
    icon: <Map size={18} strokeWidth={1.75} />,
    accent: "#2F6F5E",
  },
  {
    id: "fastapi",
    layer: "API",
    name: "FastAPI",
    blurb: "Solve · compare · Lab APIs",
    what: "Python API behind every Optimize.",
    why: "Links UI to solver and risk model.",
    more: "compare · lab/synthetic · lab/run",
    icon: <Server size={18} strokeWidth={1.75} />,
    accent: "#1F7A8C",
  },
  {
    id: "ortools",
    layer: "Optimizer",
    name: "Google OR-Tools",
    blurb: "Hard capacity + time windows",
    what: "CVRPTW planner for feasible vans.",
    why: "Real solver — not a chatbot for routes.",
    more: "Time-limited · feasible ≠ optimal",
    icon: <Route size={18} strokeWidth={1.75} />,
    accent: "#C45C26",
  },
  {
    id: "sklearn",
    layer: "ML",
    name: "scikit-learn",
    blurb: "Late-delivery risk score",
    what: "Scores chance a stop arrives late.",
    why: "Warns only — never breaks rules.",
    more: "Advisory · synthetic training",
    icon: <Brain size={18} strokeWidth={1.75} />,
    accent: "#6B4E9B",
  },
  {
    id: "sqlite",
    layer: "Data",
    name: "SQLite",
    blurb: "Demo scenarios on disk",
    what: "Local Day A/B and Lab scenarios.",
    why: "Simple MVP data for the hackathon.",
    more: "lab refreshes on each Load",
    icon: <Database size={18} strokeWidth={1.75} />,
    accent: "#3D5A80",
  },
  {
    id: "travel",
    layer: "Travel",
    name: "OSRM → Haversine",
    blurb: "Roads, else straight-line",
    what: "Travel matrix for the optimizer.",
    why: "Works when live roads are down.",
    more: "Always shows travel_source",
    icon: <Navigation size={18} strokeWidth={1.75} />,
    accent: "#8B6914",
  },
  {
    id: "nollm",
    layer: "Trust",
    name: "No LLM",
    blurb: "Math + classical ML only",
    what: "No ChatGPT inventing routes.",
    why: "Hard constraints stay hard.",
    more: "ML cannot override the solver",
    icon: <Ban size={18} strokeWidth={1.75} />,
    accent: "#1A1A1A",
  },
];

const STORAGE_KEY = "nexus-tech-card-order-v1";

/** Interactive flip + drag tech cards for the judge deck. */
export function TechStackCards() {
  const [order, setOrder] = useState<string[]>(() => DEFAULT_STACK.map((c) => c.id));
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as string[];
      const known = new Set(DEFAULT_STACK.map((c) => c.id));
      const filtered = saved.filter((id) => known.has(id));
      for (const c of DEFAULT_STACK) {
        if (!filtered.includes(c.id)) filtered.push(c.id);
      }
      setOrder(filtered);
    } catch {
      /* ignore */
    }
  }, []);

  const persist = useCallback((next: string[]) => {
    setOrder(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const cards = order
    .map((id) => DEFAULT_STACK.find((c) => c.id === id))
    .filter((c): c is TechCard => Boolean(c));

  const moveCard = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const next = [...order];
    const from = next.indexOf(fromId);
    const to = next.indexOf(toId);
    if (from < 0 || to < 0) return;
    next.splice(from, 1);
    next.splice(to, 0, fromId);
    persist(next);
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const isFlipped = Boolean(flipped[card.id]);
        const isDragging = dragId === card.id;
        const isOver = overId === card.id && dragId && dragId !== card.id;

        return (
          <div
            key={card.id}
            className={`group relative h-[176px] transition-transform duration-200 ${
              isDragging ? "z-20 scale-[1.02] opacity-70" : isOver ? "translate-y-0.5" : ""
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setOverId(card.id);
            }}
            onDragLeave={() => setOverId((v) => (v === card.id ? null : v))}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId) moveCard(dragId, card.id);
              setDragId(null);
              setOverId(null);
            }}
          >
            <div
              className={`pointer-events-none absolute inset-0 z-10 border-2 transition ${
                isOver ? "border-coral" : "border-transparent"
              }`}
            />

            <button
              type="button"
              aria-pressed={isFlipped}
              aria-label={`${card.name}. ${isFlipped ? "Show summary" : "Show details"}`}
              onClick={() => setFlipped((m) => ({ ...m, [card.id]: !m[card.id] }))}
              className="relative h-full w-full overflow-hidden text-left [perspective:1000px]"
            >
              <div
                className="relative h-full w-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] [transform-style:preserve-3d]"
                style={{ transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
              >
                {/* Front */}
                <div
                  className="absolute inset-0 flex flex-col overflow-hidden border border-hairline bg-snow p-3 transition group-hover:-translate-y-0.5 group-hover:border-ink/40 group-hover:shadow-[0_10px_24px_rgba(26,26,26,0.08)] [backface-visibility:hidden]"
                  style={{ borderTopWidth: 3, borderTopColor: card.accent }}
                >
                  <div className="flex shrink-0 items-start justify-between gap-2">
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center text-ink"
                      style={{ backgroundColor: `${card.accent}18` }}
                    >
                      {card.icon}
                    </span>
                    <span
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        setDragId(card.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="cursor-grab p-1 text-mute hover:bg-paper hover:text-ink active:cursor-grabbing"
                      title="Drag to reorder"
                      aria-label={`Reorder ${card.name}`}
                    >
                      <GripVertical size={15} />
                    </span>
                  </div>
                  <p className="mt-2.5 shrink-0 font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-mute">
                    {card.layer}
                  </p>
                  <h3 className="mt-0.5 line-clamp-1 shrink-0 font-sans text-[14px] font-semibold leading-tight text-ink">
                    {card.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 font-sans text-[11px] leading-snug text-mute">{card.blurb}</p>
                  <p className="mt-auto shrink-0 pt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-coral/80 opacity-0 transition group-hover:opacity-100">
                    Tap to flip →
                  </p>
                </div>

                {/* Back — fixed layout, no overflow spill */}
                <div
                  className="absolute inset-0 flex flex-col overflow-hidden border border-ink bg-paper p-3 [backface-visibility:hidden] [transform:rotateY(180deg)]"
                  style={{ borderTopWidth: 3, borderTopColor: card.accent }}
                >
                  <p className="shrink-0 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-mute">
                    {card.layer}
                  </p>
                  <h3 className="mt-0.5 line-clamp-1 shrink-0 font-sans text-[13px] font-semibold text-ink">
                    {card.name}
                  </h3>
                  <div className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-hidden">
                    <p className="line-clamp-2 font-sans text-[11px] leading-snug text-ink">{card.what}</p>
                    <p className="line-clamp-2 font-sans text-[11px] leading-snug text-mute">{card.why}</p>
                  </div>
                  <p className="mt-2 shrink-0 truncate border-t border-hairline pt-1.5 font-mono text-[9px] text-mute">
                    {card.more}
                  </p>
                </div>
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}
