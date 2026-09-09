import { CompareMaps } from "../../components/CompareMaps";
import { ComparisonTable } from "../../components/ComparisonTable";
import { CityMap } from "../../components/CityMap";
import { MeasuredImprovement } from "../../components/MeasuredImprovement";
import { VehicleRail } from "../../components/VehicleRail";
import { WhyThisRoute } from "../../components/WhyThisRoute";
import { useLab } from "./LabSessionContext";

export function LabPlanPage() {
  const lab = useLab();
  const hasPair = Boolean(lab.baselineSolution && lab.solution);

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-wrap items-start justify-between gap-3 border border-hairline bg-snow px-4 py-4">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-mute">Plan & compare</p>
          <h1 className="mt-1 font-sans text-[22px] font-semibold">Baseline vs Nexus</h1>
          <p className="mt-1 font-sans text-[14px] text-mute">
            Same day, two solvers. Eyes first — then measured deltas.
          </p>
        </div>
        <div className="flex overflow-hidden border border-ink" role="group" aria-label="Map view">
          {(
            [
              ["split", "Side-by-side"],
              ["baseline", "Baseline"],
              ["nexus", "Nexus"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              disabled={!hasPair && id !== "nexus"}
              onClick={() => lab.setPlanView(id)}
              className={`min-h-9 px-3 font-sans text-[12px] font-semibold disabled:opacity-40 ${
                lab.planView === id ? "bg-ink text-snow" : "bg-snow text-mute hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {!lab.solution && (
        <p className="border border-dashed border-hairline bg-snow px-4 py-6 font-sans text-[14px] text-mute">
          Run <span className="font-semibold text-ink">Optimize</span> in the top bar to generate Baseline + Nexus and
          open this compare view.
        </p>
      )}

      {lab.planView === "split" && hasPair && (
        <CompareMaps
          scenario={lab.scenario}
          baseline={lab.baselineSolution}
          nexus={lab.solution}
          selectedId={lab.selectedId}
          playMin={lab.playMin}
          onSelect={lab.setSelectedId}
        />
      )}

      {lab.planView !== "split" && lab.solution && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.9fr)]">
          <div className="relative min-h-[480px]">
            <CityMap
              scenario={lab.scenario}
              solution={lab.planView === "baseline" ? lab.baselineSolution : lab.solution}
              selectedId={lab.selectedId}
              focusVehicle={lab.focusVehicle}
              hoverVehicle={lab.hoverVehicle}
              playMin={lab.playMin}
              onSelect={lab.setSelectedId}
              onFocusVehicle={lab.setFocusVehicle}
            />
            {lab.selectedId && (
              <WhyThisRoute
                stop={lab.selected.stop}
                order={lab.selected.order}
                vehicleId={lab.selected.vehicleId}
                route={lab.selected.route}
                constraintLog={lab.solution?.constraint_log ?? []}
                held={lab.held.includes(lab.selectedId)}
                onClose={() => lab.setSelectedId(null)}
                onHold={(h) => void lab.onHold(h)}
              />
            )}
          </div>
          <VehicleRail
            routes={lab.idleRoutes}
            hoverVehicle={lab.hoverVehicle}
            focusVehicle={lab.focusVehicle}
            unavailableVehicleIds={lab.unavailableVehicleIds}
            onHover={lab.setHoverVehicle}
            onFocus={lab.setFocusVehicle}
            onSelectStop={lab.setSelectedId}
            selectedId={lab.selectedId}
          />
        </div>
      )}

      {lab.showDeltas && lab.baseline && lab.solution && (
        <MeasuredImprovement
          baseline={lab.baseline}
          nexus={lab.solution.metrics}
          feasible={lab.solution.feasible}
          partial={lab.solution.partial}
          synthetic={lab.isLab}
          orderCount={lab.orderCount}
        />
      )}

      {lab.comparisonRows.length > 0 && (
        <ComparisonTable
          rows={lab.comparisonRows}
          travelBaseline={lab.travelPair?.baseline}
          travelOptimized={lab.travelPair?.optimize}
        />
      )}
    </div>
  );
}
