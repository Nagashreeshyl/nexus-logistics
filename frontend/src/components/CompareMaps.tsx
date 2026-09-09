import { CityMap } from "./CityMap";
import type { ScenarioDetail, Solution } from "../types";

interface CompareMapsProps {
  scenario: ScenarioDetail | null;
  baseline: Solution | null;
  nexus: Solution | null;
  selectedId: string | null;
  playMin: number | null;
  onSelect: (id: string) => void;
}

/** Side-by-side Baseline vs Nexus — same scenario, two live solutions. */
export function CompareMaps({ scenario, baseline, nexus, selectedId, playMin, onSelect }: CompareMapsProps) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="flex min-h-[420px] flex-col">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border border-hairline bg-snow px-3 py-2">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-mute">Baseline</p>
            <p className="font-sans text-[14px] font-semibold">Naive first-fit + NN</p>
          </div>
          {baseline ? (
            <p className="font-mono text-[12px] text-mute">
              late <span className="font-semibold text-ink">{baseline.metrics.late_count}</span> ·{" "}
              {baseline.metrics.distance_km.toFixed(1)} km · breaches {baseline.metrics.hard_breaches}
            </p>
          ) : (
            <p className="font-mono text-[11px] text-mute">Run Optimize</p>
          )}
        </div>
        <div className="min-h-[380px] flex-1 overflow-hidden">
          <CityMap
            scenario={scenario}
            solution={baseline}
            selectedId={selectedId}
            focusVehicle={null}
            hoverVehicle={null}
            playMin={playMin}
            compact
            onSelect={onSelect}
          />
        </div>
      </div>
      <div className="flex min-h-[420px] flex-col">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border border-ink bg-snow px-3 py-2">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-coral">Nexus</p>
            <p className="font-sans text-[14px] font-semibold">OR-Tools CVRPTW</p>
          </div>
          {nexus ? (
            <p className="font-mono text-[12px] text-mute">
              late <span className="font-semibold text-ink">{nexus.metrics.late_count}</span> ·{" "}
              {nexus.metrics.distance_km.toFixed(1)} km · breaches {nexus.metrics.hard_breaches}
            </p>
          ) : (
            <p className="font-mono text-[11px] text-mute">Run Optimize</p>
          )}
        </div>
        <div className="min-h-[380px] flex-1 overflow-hidden">
          <CityMap
            scenario={scenario}
            solution={nexus}
            selectedId={selectedId}
            focusVehicle={null}
            hoverVehicle={null}
            playMin={playMin}
            compact
            onSelect={onSelect}
          />
        </div>
      </div>
    </div>
  );
}
