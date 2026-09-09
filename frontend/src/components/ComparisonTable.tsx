import type { ComparisonRow } from "../api";

interface ComparisonTableProps {
  rows: ComparisonRow[];
  travelBaseline?: string;
  travelOptimized?: string;
}

function fmt(v: number, key: string): string {
  if (key === "distance_km" || key === "avg_lateness_min" || key === "capacity_utilization") {
    return v.toFixed(2);
  }
  return String(Math.round(v));
}

export function ComparisonTable({ rows, travelBaseline, travelOptimized }: ComparisonTableProps) {
  if (!rows.length) return null;
  return (
    <section className="border border-ink bg-snow" aria-label="Baseline versus optimized">
      <div className="border-b border-hairline px-4 py-3">
        <p className="font-sans text-[12px] font-semibold uppercase tracking-wide text-mute">
          Baseline → Optimized → Improvement
        </p>
        <h2 className="mt-1 font-sans text-[18px] font-semibold text-ink">Same day, two planners</h2>
        <p className="mt-1 max-w-[70ch] font-sans text-[13px] text-mute">
          BASELINE is a simple heuristic (can overfill vans). OPTIMIZED is OR-Tools with hard capacity and time
          windows. Improvements are calculated from this run — not hardcoded.
        </p>
        <p className="mt-2 font-mono text-[11px] text-mute">
          Travel source: baseline={travelBaseline ?? "—"} · optimized={travelOptimized ?? "—"}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left font-mono text-[12px]">
          <thead>
            <tr className="border-b border-hairline bg-paper">
              <th className="px-4 py-2 font-sans font-semibold text-ink">Metric</th>
              <th className="px-4 py-2 font-sans font-semibold text-ink">Baseline</th>
              <th className="px-4 py-2 font-sans font-semibold text-ink">Optimized</th>
              <th className="px-4 py-2 font-sans font-semibold text-ink">Improvement</th>
              <th className="px-4 py-2 font-sans font-semibold text-mute">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const imp =
                r.improvement_pct == null
                  ? "—"
                  : `${r.improvement_pct > 0 ? "+" : ""}${r.improvement_pct}%`;
              const good = r.improvement_pct != null && r.improvement_pct > 0;
              return (
                <tr key={r.key} className="border-b border-hairline">
                  <td className="px-4 py-2 font-sans text-ink">{r.metric}</td>
                  <td className="px-4 py-2 tabular">{fmt(r.baseline, r.key)}</td>
                  <td className="px-4 py-2 tabular">{fmt(r.optimized, r.key)}</td>
                  <td className={`px-4 py-2 tabular ${good ? "text-ink font-semibold" : "text-mute"}`}>{imp}</td>
                  <td className="px-4 py-2 font-sans text-[11px] text-mute">{r.better_when}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
