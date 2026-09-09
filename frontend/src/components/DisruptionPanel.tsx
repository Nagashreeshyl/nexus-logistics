import type { Metrics } from "../types";

interface DisruptionPanelProps {
  vehicleIds: string[];
  selectedVehicle: string | null;
  unavailableVehicleIds: string[];
  busy: boolean;
  hasPlan: boolean;
  beforeMetrics: Metrics | null;
  afterMetrics: Metrics | null;
  onSelectVehicle: (id: string | null) => void;
  onSimulate: () => void;
  onClear: () => void;
}

export function DisruptionPanel({
  vehicleIds,
  selectedVehicle,
  unavailableVehicleIds,
  busy,
  hasPlan,
  beforeMetrics,
  afterMetrics,
  onSelectVehicle,
  onSimulate,
  onClear,
}: DisruptionPanelProps) {
  const down = unavailableVehicleIds[0] ?? null;
  const canSim = hasPlan && Boolean(selectedVehicle) && !busy && !down;

  return (
    <section className="border border-ink bg-snow px-4 py-4" aria-label="Simulate disruption">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-mute">Simulate disruption</p>
      <h3 className="mt-1 font-sans text-[18px] font-semibold text-ink">Vehicle breakdown → real reoptimization</h3>
      <p className="mt-1 max-w-[62ch] font-sans text-[13px] text-mute">
        Marks one van unavailable and re-runs OR-Tools on the remaining fleet via{" "}
        <span className="font-mono text-ink">POST /api/lab/run</span> with{" "}
        <span className="font-mono text-ink">exclude_vehicle_ids</span>. No frontend reassignment.
      </p>

      {!hasPlan && (
        <p className="mt-3 font-sans text-[13px] text-mute">Optimize a plan first, then select a vehicle.</p>
      )}

      {hasPlan && !down && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="font-mono text-[11px] uppercase text-mute" htmlFor="breakdown-van">
            Select vehicle
          </label>
          <select
            id="breakdown-van"
            className="min-h-10 border border-hairline bg-paper px-3 font-mono text-[13px] text-ink"
            value={selectedVehicle ?? ""}
            onChange={(e) => onSelectVehicle(e.target.value || null)}
            disabled={busy}
          >
            <option value="">Choose van…</option>
            {vehicleIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!canSim}
            onClick={onSimulate}
            className="inline-flex min-h-10 items-center bg-coral px-4 font-sans text-[13px] font-semibold text-ink disabled:opacity-40"
          >
            {busy ? "Reoptimizing…" : "Simulate vehicle breakdown"}
          </button>
        </div>
      )}

      {down && (
        <div className="mt-4 space-y-3">
          <p className="border border-coral bg-[#FFF5F2] px-3 py-2 font-sans text-[14px] font-semibold text-ink">
            ⚠ Vehicle {down} UNAVAILABLE
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="border border-hairline p-3">
              <p className="font-mono text-[10px] uppercase text-mute">Before</p>
              <p className="mt-1 font-sans text-[13px] text-ink">
                Active fleet: {vehicleIds.filter((id) => id !== down).concat(down).join(" ")}
              </p>
              {beforeMetrics && (
                <p className="mt-2 font-mono text-[11px] text-mute">
                  late {beforeMetrics.late_count} · {beforeMetrics.distance_km.toFixed(1)} km · deferred{" "}
                  {beforeMetrics.unassigned_count}
                </p>
              )}
            </div>
            <div className="border border-coral p-3">
              <p className="font-mono text-[10px] uppercase text-coral">Breakdown</p>
              <p className="mt-1 font-sans text-[13px] font-semibold text-ink">{down} unavailable</p>
              <p className="mt-2 font-sans text-[12px] text-mute">Remaining fleet reoptimized by solver</p>
            </div>
            <div className="border border-hairline p-3">
              <p className="font-mono text-[10px] uppercase text-mute">After</p>
              <p className="mt-1 font-sans text-[13px] text-ink">
                Active fleet: {vehicleIds.filter((id) => id !== down).join(" ") || "—"}
              </p>
              {afterMetrics && (
                <p className="mt-2 font-mono text-[11px] text-mute">
                  late {afterMetrics.late_count} · {afterMetrics.distance_km.toFixed(1)} km · deferred{" "}
                  {afterMetrics.unassigned_count}
                  {afterMetrics.hard_breaches ? ` · breaches ${afterMetrics.hard_breaches}` : ""}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClear}
            className="border border-hairline px-3 py-2 font-sans text-[13px] font-semibold text-ink hover:border-ink"
          >
            Clear disruption (keep current plan)
          </button>
        </div>
      )}
    </section>
  );
}
