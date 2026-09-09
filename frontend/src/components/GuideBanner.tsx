interface GuideBannerProps {
  hasSolution: boolean;
  scenarioId: "a" | "b";
  onBaseline: () => void;
  onOptimize: () => void;
  onCompare: () => void;
  busy: boolean;
}

export function GuideBanner({
  hasSolution,
  scenarioId,
  onBaseline,
  onOptimize,
  onCompare,
  busy,
}: GuideBannerProps) {
  if (hasSolution) return null;

  const dayA = scenarioId === "a";

  return (
    <section className="border border-ink bg-snow px-5 py-5" aria-label="Getting started">
      <p className="font-sans text-[12px] font-semibold uppercase tracking-wide text-coral">Do this next</p>
      <h2 className="mt-1 font-sans text-[22px] font-semibold tracking-tight text-ink">
        {dayA ? "Normal day — prove measurable improvement" : "Overloaded day — prove constraint-aware fallback"}
      </h2>
      <p className="mt-2 max-w-[68ch] font-sans text-[15px] leading-relaxed text-mute">
        {dayA
          ? "Run Compare both to evaluate the same stops with a naive heuristic and OR-Tools. The table shows distance, late deliveries, lateness, and violations — calculated live, not hardcoded."
          : "Too many stops for the fleet. Smart optimize keeps criticals, defers the rest with reasons, and never relaxes capacity or time windows. Then inspect deferred → hold → re-solve."}
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        {dayA ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={onCompare}
              className="min-h-12 bg-coral px-5 py-3 font-sans text-[15px] font-semibold text-ink hover:brightness-95 disabled:opacity-40"
            >
              Compare both (recommended)
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onBaseline}
              className="min-h-12 border border-hairline bg-paper px-5 py-3 font-sans text-[15px] font-semibold text-ink hover:border-ink disabled:opacity-40"
            >
              Naive only
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onOptimize}
              className="min-h-12 border border-hairline bg-paper px-5 py-3 font-sans text-[15px] font-semibold text-ink hover:border-ink disabled:opacity-40"
            >
              Smart only
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={onOptimize}
              className="min-h-12 bg-coral px-5 py-3 font-sans text-[15px] font-semibold text-ink hover:brightness-95 disabled:opacity-40"
            >
              Smart optimize (show deferred)
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onCompare}
              className="min-h-12 border border-hairline bg-paper px-5 py-3 font-sans text-[15px] font-semibold text-ink hover:border-ink disabled:opacity-40"
            >
              Compare both
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onBaseline}
              className="min-h-12 border border-hairline bg-paper px-5 py-3 font-sans text-[15px] font-semibold text-ink hover:border-ink disabled:opacity-40"
            >
              Naive (shows capacity breaks)
            </button>
          </>
        )}
      </div>
    </section>
  );
}
