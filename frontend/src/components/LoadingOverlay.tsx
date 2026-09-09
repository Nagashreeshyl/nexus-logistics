import { Loader2 } from "lucide-react";

const STAGES = [
  "Loading scenario from SQLite",
  "Building OSRM road matrix",
  "Solving CVRPTW constraints",
  "Scoring late-risk overlay",
  "Snapping routes to OSM",
];

interface LoadingOverlayProps {
  mode: "baseline" | "optimize" | "compare" | "synthetic" | null;
  stageIndex: number;
}

export function LoadingOverlay({ mode, stageIndex }: LoadingOverlayProps) {
  if (!mode) return null;
  const label =
    mode === "compare"
      ? "Comparing baseline vs optimize"
      : mode === "baseline"
        ? "Running baseline"
        : mode === "synthetic"
          ? "Generating synthetic day"
          : "Optimizing routes";
  const active = Math.min(stageIndex, STAGES.length - 1);

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-paper/80 px-4 backdrop-blur-[2px]"
      role="alertdialog"
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
    >
      <div className="w-full max-w-md border border-ink bg-snow p-6 shadow-card">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-coral" aria-hidden />
          <div>
            <p className="sys text-mute">Sys.ops // Solver</p>
            <h2 className="font-display text-[28px] font-medium leading-tight text-ink">{label}</h2>
          </div>
        </div>
        <ol className="mt-5 space-y-2">
          {STAGES.map((stage, i) => (
            <li
              key={stage}
              className={`font-mono text-[12px] ${
                i < active ? "text-ink" : i === active ? "text-coral" : "text-mute"
              }`}
            >
              {i < active ? "✓" : i === active ? "→" : "·"} {stage}
            </li>
          ))}
        </ol>
        <p className="mt-5 font-mono text-[11px] leading-relaxed text-mute">
          First solve hits live OSRM (~5–15s). Repeats use Redis/memory cache and return almost instantly.
          Capacity and time windows stay hard.
        </p>
      </div>
    </div>
  );
}
