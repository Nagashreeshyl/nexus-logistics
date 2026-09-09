import { CityMap } from "../../components/CityMap";
import { ConstraintLog } from "../../components/ConstraintLog";
import { DeferredList } from "../../components/DeferredList";
import { DisruptionPanel } from "../../components/DisruptionPanel";
import { ExceptionStory } from "../../components/ExceptionStory";
import { useLab } from "./LabSessionContext";

export function LabExceptionsPage() {
  const lab = useLab();

  return (
    <div className="flex flex-col gap-4">
      <section className="border border-hairline bg-snow px-4 py-4">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-mute">Exceptions</p>
        <h1 className="mt-1 font-sans text-[22px] font-semibold">Breakdown · rush · defer</h1>
        <p className="mt-1 font-sans text-[14px] text-mute">
          Intelligent exception handling without breaking hard constraints. Before/After map appears after a real van
          exclusion.
        </p>
        <button
          type="button"
          disabled={lab.busy || !lab.scenario}
          onClick={() => void lab.injectRushOrder()}
          className="mt-3 inline-flex min-h-10 items-center border border-ink bg-snow px-4 font-sans text-[13px] font-semibold disabled:opacity-40"
        >
          Inject rush order + re-solve
        </button>
        {lab.rushOrderId && (
          <p className="mt-2 font-mono text-[12px] text-mute">
            Last rush: <span className="text-ink">{lab.rushOrderId}</span>
          </p>
        )}
      </section>

      {lab.solution && lab.scenario && (
        <DisruptionPanel
          vehicleIds={lab.scenario.vehicles.map((v) => v.vehicle_id)}
          selectedVehicle={lab.breakdownVehicle}
          unavailableVehicleIds={lab.unavailableVehicleIds}
          busy={lab.busy}
          hasPlan={Boolean(lab.solution)}
          beforeMetrics={lab.preDisruption?.metrics ?? null}
          afterMetrics={lab.unavailableVehicleIds.length ? lab.solution.metrics : null}
          onSelectVehicle={(id) => {
            lab.setBreakdownVehicle(id);
            if (id) lab.setFocusVehicle(id);
          }}
          onSimulate={() => void lab.simulateBreakdown()}
          onClear={lab.clearDisruption}
        />
      )}

      <div className="relative min-h-[420px]">
        {lab.mapShowCompare && (
          <div className="absolute right-3 top-3 z-[600] flex overflow-hidden border border-ink bg-snow shadow-card">
            <button
              type="button"
              onClick={() => lab.setMapTimeline("before")}
              className={`px-3 py-1.5 font-sans text-[12px] font-semibold ${
                lab.mapTimeline === "before" ? "bg-ink text-snow" : "text-mute"
              }`}
            >
              Before
            </button>
            <button
              type="button"
              onClick={() => lab.setMapTimeline("after")}
              className={`px-3 py-1.5 font-sans text-[12px] font-semibold ${
                lab.mapTimeline === "after" ? "bg-ink text-snow" : "text-mute"
              }`}
            >
              After
            </button>
          </div>
        )}
        <CityMap
          scenario={lab.scenario}
          solution={lab.mapSolution}
          selectedId={lab.selectedId}
          focusVehicle={lab.focusVehicle}
          hoverVehicle={lab.hoverVehicle}
          playMin={lab.playMin}
          unavailableVehicleIds={lab.mapUnavailableIds}
          onSelect={lab.setSelectedId}
          onFocusVehicle={lab.setFocusVehicle}
        />
      </div>

      {lab.solution && (
        <ExceptionStory
          partial={lab.solution.partial}
          unassigned={lab.solution.unassigned}
          log={lab.solution.constraint_log}
          metrics={lab.solution.metrics}
          heldCount={lab.held.length}
        />
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <DeferredList
          items={lab.solution?.unassigned ?? []}
          reasons={lab.solution?.constraint_log ?? []}
          onSelect={lab.setSelectedId}
        />
        <ConstraintLog items={lab.solution?.constraint_log ?? []} />
      </div>

      {lab.held.length > 0 && (
        <button
          type="button"
          onClick={() => void lab.onClearHolds()}
          className="self-start border border-coral px-4 py-2 font-sans text-[13px] font-semibold text-coral"
        >
          Clear {lab.held.length} holds
        </button>
      )}
    </div>
  );
}
