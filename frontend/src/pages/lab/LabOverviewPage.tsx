import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { CityMap } from "../../components/CityMap";
import { Scoreboard } from "../../components/Scoreboard";
import { useLab } from "./LabSessionContext";

export function LabOverviewPage() {
  const lab = useLab();

  return (
    <div className="flex flex-col gap-4">
      <section className="border border-hairline bg-snow px-4 py-4">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-mute">Overview</p>
        <h1 className="mt-1 font-sans text-[clamp(1.5rem,3vw,2rem)] font-semibold">Last-mile Lab · JP-019</h1>
        <p className="mt-2 max-w-2xl font-sans text-[14px] text-mute">
          Load a scenario, run real OR-Tools vs naive baseline, inspect late risk and exceptions. Hard capacity and
          time windows are never broken by ML.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            to="/optimizer/scenario"
            className="inline-flex min-h-10 items-center border border-ink bg-snow px-4 font-sans text-[13px] font-semibold text-ink no-underline"
          >
            Scenario →
          </Link>
          <button
            type="button"
            disabled={lab.busy || !lab.scenario}
            onClick={() => void lab.runCompare()}
            className="inline-flex min-h-10 items-center gap-2 bg-coral px-4 font-sans text-[13px] font-semibold disabled:opacity-40"
          >
            {lab.solving === "compare" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Optimize → Plan
          </button>
          <Link
            to="/optimizer/plan"
            className="inline-flex min-h-10 items-center border border-hairline px-4 font-sans text-[13px] font-semibold text-ink no-underline"
          >
            Open Plan & Compare
          </Link>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Orders", lab.orderCount],
          ["Vans", lab.vanCount],
          ["Critical", lab.criticalCount],
          ["High-risk", lab.highRiskCount],
        ].map(([k, v]) => (
          <article key={String(k)} className="border border-hairline bg-snow px-4 py-3">
            <p className="font-mono text-[10px] uppercase text-mute">{k}</p>
            <p className="mt-1 font-sans text-[28px] font-semibold tabular">{lab.scenarioLoading ? "…" : v}</p>
          </article>
        ))}
      </div>

      <Scoreboard
        metrics={lab.solution?.metrics ?? null}
        baseline={lab.baseline}
        showDeltas={lab.showDeltas}
        loading={lab.busy}
      />

      <div className="relative min-h-[360px] overflow-hidden">
        <CityMap
          scenario={lab.scenario}
          solution={lab.solution}
          selectedId={lab.selectedId}
          focusVehicle={lab.focusVehicle}
          hoverVehicle={lab.hoverVehicle}
          playMin={lab.playMin}
          unavailableVehicleIds={lab.mapUnavailableIds}
          onSelect={lab.setSelectedId}
          onFocusVehicle={lab.setFocusVehicle}
        />
      </div>

      {lab.briefing.length > 0 && (
        <ul className="border border-hairline bg-snow px-4 py-3 font-sans text-[13px] text-mute">
          {lab.briefing.map((line) => (
            <li key={line}>· {line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
