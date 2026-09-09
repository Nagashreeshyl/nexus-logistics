import { useEffect, useState } from "react";
import { fetchWinSheet, type WinSheet } from "../api";
import { ComparisonTable } from "./ComparisonTable";

interface WinSheetPanelProps {
  scenarioId: string;
  open: boolean;
  onClose: () => void;
}

export function WinSheetPanel({ scenarioId, open, onClose }: WinSheetPanelProps) {
  const [sheet, setSheet] = useState<WinSheet | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setErr(null);
    fetchWinSheet(scenarioId)
      .then(setSheet)
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [open, scenarioId]);

  if (!open) return null;

  const m = sheet?.risk_model?.holdout_metrics;

  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <div className="max-h-[90dvh] w-full max-w-3xl overflow-y-auto border border-ink bg-snow shadow-card">
        <div className="sticky top-0 flex items-center justify-between border-b border-hairline bg-snow px-5 py-3">
          <h2 className="font-sans text-[18px] font-semibold">Judge win sheet</h2>
          <button type="button" onClick={onClose} className="font-sans text-[13px] font-semibold underline">
            Close
          </button>
        </div>
        <div className="space-y-5 px-5 py-4 font-sans text-[14px] text-ink">
          {loading && <p className="text-mute">Computing measured comparison…</p>}
          {err && <p className="text-coral">{err}</p>}
          {sheet && (
            <>
              <section>
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-mute">What was the problem?</h3>
                <p className="mt-1 leading-relaxed">{sheet.problem}</p>
              </section>
              <section>
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-mute">What did we build?</h3>
                <p className="mt-1 leading-relaxed">{sheet.built}</p>
              </section>
              <section>
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-mute">Why is it intelligent?</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-mute">
                  {sheet.why_intelligent.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-mute">What did we measure?</h3>
                <ComparisonTable
                  rows={sheet.measured}
                  travelBaseline={undefined}
                  travelOptimized={sheet.travel_source_optimize}
                />
                {sheet.baseline_note && (
                  <p className="mt-2 font-mono text-[11px] text-mute">{sheet.baseline_note}</p>
                )}
                {sheet.optimized_note && (
                  <p className="mt-1 font-mono text-[11px] text-mute">{sheet.optimized_note}</p>
                )}
              </section>
              <section>
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-mute">What improved?</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {sheet.improved.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </section>
              {m && (
                <section>
                  <h3 className="text-[12px] font-semibold uppercase tracking-wide text-mute">
                    Late-risk model holdout (synthetic)
                  </h3>
                  <p className="mt-1 font-mono text-[12px]">
                    Post-route Acc {m.accuracy} · Prec {m.precision} · Rec {m.recall} · F1 {m.f1} · ROC-AUC {m.roc_auc}
                  </p>
                  {sheet.risk_model?.pre_route_metrics && (
                    <p className="mt-1 font-mono text-[12px]">
                      Pre-route triage F1 {sheet.risk_model.pre_route_metrics.f1} · ROC-AUC{" "}
                      {sheet.risk_model.pre_route_metrics.roc_auc}
                    </p>
                  )}
                  <p className="mt-1 font-sans text-[12px] text-mute">
                    Excluded: {(sheet.risk_model?.excluded_features ?? []).join(", ") || "—"}. Separate pre-route
                    model — no placeholder load/sequence. Not production-validated.
                  </p>
                </section>
              )}
              <section>
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-mute">
                  When no perfect solution exists
                </h3>
                <p className="mt-1 text-mute">{sheet.when_no_perfect_solution.note}</p>
                <p className="mt-1 font-mono text-[12px]">
                  Partial={String(sheet.when_no_perfect_solution.partial)} · Deferred=
                  {sheet.when_no_perfect_solution.deferred_count}
                </p>
              </section>
              <section>
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-mute">What data did we use?</h3>
                <p className="mt-1 font-semibold text-coral">{sheet.data_used}</p>
              </section>
              <section>
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-mute">Limitations</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-mute">
                  {sheet.limitations.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
