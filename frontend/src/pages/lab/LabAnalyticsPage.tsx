import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useLab } from "./LabSessionContext";
import { onTimePct } from "./labTypes";

function barWidthPct(value: number, rowMax: number): number {
  if (rowMax <= 0 || value <= 0) return 0;
  return Math.min(100, (value / rowMax) * 100);
}

function GroupedBars({
  title,
  pairs,
}: {
  title: string;
  pairs: { label: string; baseline: number; nexus: number; unit?: string }[];
}) {
  return (
    <section className="border border-hairline bg-snow px-4 py-4">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-mute">{title}</p>
      <div className="mt-4 space-y-5">
        {pairs.map((p) => {
          const rowMax = Math.max(p.baseline, p.nexus, 0);
          const bPct = barWidthPct(p.baseline, rowMax);
          const nPct = barWidthPct(p.nexus, rowMax);
          const unit = p.unit ?? "";
          return (
            <div key={p.label}>
              <div className="mb-1.5 flex justify-between gap-3 font-sans text-[12px]">
                <span className="font-semibold text-ink">{p.label}</span>
                <span className="shrink-0 font-mono tabular text-mute">
                  {p.baseline}
                  {unit} → {p.nexus}
                  {unit}
                </span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-4 shrink-0 font-mono text-[9px] font-semibold text-mute">B</span>
                  <div className="relative h-5 flex-1 bg-paper">
                    {bPct > 0 ? (
                      <div
                        className="absolute inset-y-0 left-0 bg-[#c8c6c0] transition-[width] duration-300"
                        style={{ width: `${bPct}%` }}
                        title={`Baseline ${p.baseline}${unit}`}
                      />
                    ) : (
                      <span className="absolute inset-y-0 left-0 flex items-center pl-1 font-mono text-[9px] text-mute">
                        0
                      </span>
                    )}
                  </div>
                  <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular text-ink">
                    {p.baseline}
                    {unit}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 shrink-0 font-mono text-[9px] font-semibold text-coral">N</span>
                  <div className="relative h-5 flex-1 bg-paper">
                    {nPct > 0 ? (
                      <div
                        className="absolute inset-y-0 left-0 bg-coral transition-[width] duration-300"
                        style={{ width: `${nPct}%` }}
                        title={`Nexus ${p.nexus}${unit}`}
                      />
                    ) : (
                      <span className="absolute inset-y-0 left-0 flex items-center pl-1 font-mono text-[9px] text-mute">
                        0
                      </span>
                    )}
                  </div>
                  <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular text-ink">
                    {p.nexus}
                    {unit}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 font-mono text-[10px] text-mute">
        Each row scaled to its own max · Grey = Baseline · Coral = Nexus · bar length = value
      </p>
    </section>
  );
}

function HistoryBars({
  items,
}: {
  items: { id: number; label: string; late: number; km: number }[];
}) {
  if (!items.length) {
    return (
      <p className="border border-dashed border-hairline bg-snow px-4 py-6 font-sans text-[14px] text-mute">
        No solve history yet. Run Optimize a few times to see late / km across runs.
      </p>
    );
  }
  const maxLate = Math.max(...items.map((i) => i.late), 0);
  const maxKm = Math.max(...items.map((i) => i.km), 0);

  return (
    <section className="border border-hairline bg-snow px-4 py-4">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-mute">
        Recent solves · from Lab history
      </p>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div>
          <p className="mb-2 font-sans text-[12px] font-semibold text-ink">Late count</p>
          <div className="flex items-end gap-2 overflow-x-auto pb-1" style={{ minHeight: 120 }}>
            {items.map((i) => {
              const h = maxLate > 0 ? (i.late / maxLate) * 100 : 0;
              return (
                <div key={`late-${i.id}`} className="flex w-10 shrink-0 flex-col items-center gap-1">
                  <span className="font-mono text-[9px] tabular text-mute">{i.late}</span>
                  <div className="flex h-24 w-full items-end justify-center bg-paper">
                    <div
                      className="w-6 bg-[#c8c6c0] transition-[height] duration-300"
                      style={{ height: h > 0 ? `${h}%` : "0%" }}
                      title={`Late ${i.late}`}
                    />
                  </div>
                  <span className="font-mono text-[9px] text-mute">{i.label}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <p className="mb-2 font-sans text-[12px] font-semibold text-ink">Distance (km)</p>
          <div className="flex items-end gap-2 overflow-x-auto pb-1" style={{ minHeight: 120 }}>
            {items.map((i) => {
              const h = maxKm > 0 ? (i.km / maxKm) * 100 : 0;
              return (
                <div key={`km-${i.id}`} className="flex w-10 shrink-0 flex-col items-center gap-1">
                  <span className="font-mono text-[9px] tabular text-mute">{i.km}</span>
                  <div className="flex h-24 w-full items-end justify-center bg-paper">
                    <div
                      className="w-6 bg-coral transition-[height] duration-300"
                      style={{ height: h > 0 ? `${h}%` : "0%" }}
                      title={`Km ${i.km}`}
                    />
                  </div>
                  <span className="font-mono text-[9px] text-mute">{i.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export function LabAnalyticsPage() {
  const lab = useLab();
  const base = lab.baseline;
  const nexus = lab.solution?.metrics;
  const baseOt = base && lab.orderCount ? onTimePct(base.late_count, lab.orderCount) : null;
  const nexusOt = nexus && lab.orderCount ? onTimePct(nexus.late_count, lab.orderCount) : null;

  const historyChart = useMemo(
    () =>
      [...lab.history]
        .slice(0, 12)
        .reverse()
        .map((h, idx) => ({
          id: h.id,
          label: `#${idx + 1}`,
          late: h.metrics.late_count,
          km: Number(h.metrics.distance_km.toFixed(1)),
        })),
    [lab.history],
  );

  return (
    <div className="flex flex-col gap-4">
      <section className="border border-hairline bg-snow px-4 py-4">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-mute">Analytics</p>
        <h1 className="mt-1 font-sans text-[22px] font-semibold">Live graphs · this Lab session</h1>
        <p className="mt-1 max-w-2xl font-sans text-[14px] text-mute">
          Charts update from real Optimize / solve results — never hardcoded. Run Optimize to fill Baseline vs Nexus.
        </p>
        <Link
          to="/optimizer/plan"
          className="mt-3 inline-flex font-sans text-[13px] font-semibold text-ink underline"
        >
          Open Plan & Compare →
        </Link>
      </section>

      {!base || !nexus ? (
        <p className="border border-dashed border-hairline bg-snow px-4 py-8 text-center font-sans text-[14px] text-mute">
          No compare pair yet. Press <span className="font-semibold text-ink">Optimize</span> in the top bar.
        </p>
      ) : (
        <>
          <GroupedBars
            title="Baseline vs Nexus · this run"
            pairs={[
              { label: "Late deliveries", baseline: base.late_count, nexus: nexus.late_count },
              {
                label: "Distance (km)",
                baseline: Number(base.distance_km.toFixed(1)),
                nexus: Number(nexus.distance_km.toFixed(1)),
              },
              { label: "Hard breaches", baseline: base.hard_breaches, nexus: nexus.hard_breaches },
              { label: "Deferred", baseline: base.unassigned_count, nexus: nexus.unassigned_count },
            ]}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <article className="border border-hairline bg-snow px-4 py-4">
              <p className="font-mono text-[10px] uppercase text-mute">On-time % · Baseline</p>
              <p className="mt-1 font-sans text-[32px] font-semibold tabular">
                {baseOt != null ? `${baseOt.toFixed(0)}%` : "—"}
              </p>
            </article>
            <article className="border border-ink bg-snow px-4 py-4">
              <p className="font-mono text-[10px] uppercase text-mute">On-time % · Nexus</p>
              <p className="mt-1 font-sans text-[32px] font-semibold tabular">
                {nexusOt != null ? `${nexusOt.toFixed(0)}%` : "—"}
              </p>
              <p className="mt-1 font-mono text-[11px] text-mute">travel {lab.solution?.travel_source}</p>
            </article>
          </div>
        </>
      )}

      <HistoryBars items={historyChart} />
    </div>
  );
}
