import { CityMap } from "../../components/CityMap";
import { WhyThisRoute } from "../../components/WhyThisRoute";
import { useLab } from "./LabSessionContext";
import { highRiskStops } from "./labTypes";

export function LabRiskPage() {
  const lab = useLab();
  const ranked = highRiskStops(lab.solution);

  return (
    <div className="flex flex-col gap-4">
      <section className="border border-hairline bg-snow px-4 py-4">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-mute">Late risk</p>
        <h1 className="mt-1 font-sans text-[22px] font-semibold">Likely late deliveries</h1>
        <p className="mt-1 max-w-2xl font-sans text-[14px] text-mute">
          GradientBoostingClassifier scores after the plan exists. Advisory only — never relaxes capacity or time
          windows. Synthetic training; not production-validated.
        </p>
        <p className="mt-3 font-mono text-[12px] text-mute">
          High-risk stops (p_late ≥ 0.55):{" "}
          <span className="font-semibold text-ink">{lab.solution ? ranked.length : "—"}</span>
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.4fr)]">
        <div className="max-h-[min(70vh,640px)] overflow-y-auto border border-hairline bg-snow">
          {!lab.solution && (
            <p className="px-4 py-6 font-sans text-[13px] text-mute">Optimize first to score risk on routes.</p>
          )}
          {lab.solution && ranked.length === 0 && (
            <p className="px-4 py-6 font-sans text-[13px] text-mute">No stops at or above the 0.55 triage threshold.</p>
          )}
          <ul>
            {ranked.map((row) => (
              <li key={row.order_id}>
                <button
                  type="button"
                  onClick={() => lab.setSelectedId(row.order_id)}
                  className={`flex w-full items-start justify-between gap-2 border-b border-hairline px-4 py-3 text-left font-sans text-[13px] ${
                    lab.selectedId === row.order_id ? "bg-paper" : "hover:bg-paper/80"
                  }`}
                >
                  <span>
                    <span className="font-semibold text-ink">{row.order_id}</span>
                    <span className="mt-0.5 block font-mono text-[11px] text-mute">{row.vehicle_id}</span>
                  </span>
                  <span className="font-mono text-[13px] font-semibold text-coral">{row.p_late.toFixed(2)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative min-h-[420px]">
          <CityMap
            scenario={lab.scenario}
            solution={lab.solution}
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
      </div>
    </div>
  );
}
