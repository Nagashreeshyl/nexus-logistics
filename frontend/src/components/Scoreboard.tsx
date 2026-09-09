import type { Metrics } from "../types";
import { deltaClass, formatDelta } from "../lib/format";

interface ScoreboardProps {
  metrics: Metrics | null;
  baseline: Metrics | null;
  showDeltas: boolean;
  loading?: boolean;
}

type CardKey = keyof Metrics;

const CARDS: { key: CardKey; label: string; hint: string; lowerBetter?: boolean }[] = [
  { key: "late_count", label: "Late deliveries", hint: "After window end", lowerBetter: true },
  { key: "avg_lateness_min", label: "Avg lateness", hint: "Mean minutes late (lates only)", lowerBetter: true },
  { key: "distance_km", label: "Distance & time", hint: "All vans combined", lowerBetter: true },
  { key: "hard_breaches", label: "Rule breaks", hint: "Capacity + window violations", lowerBetter: true },
  { key: "unassigned_count", label: "Deferred", hint: "Not assigned this wave", lowerBetter: true },
  { key: "criticals_served", label: "Criticals served", hint: "Priority stops completed", lowerBetter: false },
  { key: "capacity_utilization", label: "Utilization", hint: "Mean load ÷ capacity on used vans" },
];

function fmtValue(metrics: Metrics, key: CardKey): string {
  if (key === "distance_km") {
    return `${metrics.distance_km.toFixed(1)} km · ${metrics.time_min} min`;
  }
  if (key === "avg_lateness_min") {
    const v = metrics.avg_lateness_min ?? 0;
    return `${Number(v).toFixed(1)} min`;
  }
  if (key === "capacity_utilization") {
    const v = metrics.capacity_utilization ?? 0;
    return `${Math.round(Number(v) * 100)}%`;
  }
  if (key === "vehicles_used") {
    return String(metrics.vehicles_used ?? "—");
  }
  const raw = metrics[key];
  return raw == null ? "—" : String(raw);
}

export function Scoreboard({ metrics, baseline, showDeltas, loading = false }: ScoreboardProps) {
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7" aria-live="polite" aria-label="Scoreboard">
      {CARDS.map((card) => {
        let value = "—";
        let delta: string | null = null;
        let dClass = "text-mute";
        if (metrics) {
          value = fmtValue(metrics, card.key);
          if (showDeltas && baseline && card.lowerBetter != null) {
            const cur = Number(metrics[card.key] ?? 0);
            const base = Number(baseline[card.key] ?? 0);
            const d = cur - base;
            if (card.key === "distance_km") {
              delta = `${formatDelta(d, 1)} km`;
            } else if (card.key === "avg_lateness_min") {
              delta = `${formatDelta(d, 1)} min`;
            } else {
              delta = formatDelta(d);
            }
            dClass = deltaClass(d, card.lowerBetter);
          }
        }
        return (
          <article key={card.key} className="min-h-[108px] border border-hairline bg-snow p-4">
            <p className="font-sans text-[12px] font-semibold text-ink">{card.label}</p>
            <p className="mt-0.5 font-sans text-[11px] text-mute">{card.hint}</p>
            {loading && !metrics ? (
              <div className="skeleton mt-3 h-7 w-24" aria-hidden />
            ) : (
              <p className="mt-3 font-mono text-[20px] font-semibold tabular text-ink sm:text-[22px]">{value}</p>
            )}
            {showDeltas && delta != null ? (
              <p className={`mt-1 font-sans text-[12px] font-medium ${dClass}`}>vs naive {delta}</p>
            ) : (
              !metrics && !loading && (
                <p className="mt-1 font-sans text-[12px] text-mute">Run a plan to fill this</p>
              )
            )}
          </article>
        );
      })}
    </section>
  );
}
