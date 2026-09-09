import { Jp019Checklist } from "../../components/Jp019Checklist";
import { MeasuredImprovement } from "../../components/MeasuredImprovement";
import { HistoryPanel } from "../../components/HistoryPanel";
import { useLab } from "./LabSessionContext";
import { onTimePct } from "./labTypes";

export function LabEvidencePage() {
  const lab = useLab();
  const baseOnTime = lab.baseline && lab.orderCount ? onTimePct(lab.baseline.late_count, lab.orderCount) : null;
  const nexusOnTime =
    lab.solution && lab.orderCount ? onTimePct(lab.solution.metrics.late_count, lab.orderCount) : null;

  return (
    <div className="flex flex-col gap-4">
      <section className="border border-hairline bg-snow px-4 py-4">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-mute">Evidence</p>
        <h1 className="mt-1 font-sans text-[22px] font-semibold">JP-019 proof · this session</h1>
        <p className="mt-1 font-sans text-[14px] text-mute">
          Checklist only ticks from live Lab runs. Open Win sheet for the judge-facing summary.
        </p>
        <button
          type="button"
          disabled={lab.busy}
          onClick={() => lab.setWinOpen(true)}
          className="mt-3 inline-flex min-h-10 items-center border border-ink bg-snow px-4 font-sans text-[13px] font-semibold disabled:opacity-40"
        >
          Open Win sheet
        </button>
      </section>

      {(baseOnTime != null || nexusOnTime != null) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <article className="border border-hairline bg-snow px-4 py-3">
            <p className="font-mono text-[10px] uppercase text-mute">On-time % · Baseline</p>
            <p className="mt-1 font-sans text-[28px] font-semibold tabular">
              {baseOnTime != null ? `${baseOnTime.toFixed(0)}%` : "—"}
            </p>
            <p className="font-mono text-[11px] text-mute">from late_count / orders (this run)</p>
          </article>
          <article className="border border-ink bg-snow px-4 py-3">
            <p className="font-mono text-[10px] uppercase text-mute">On-time % · Nexus</p>
            <p className="mt-1 font-sans text-[28px] font-semibold tabular">
              {nexusOnTime != null ? `${nexusOnTime.toFixed(0)}%` : "—"}
            </p>
            <p className="font-mono text-[11px] text-mute">
              travel {lab.solution?.travel_source ?? "—"}
            </p>
          </article>
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

      <Jp019Checklist items={lab.jp019Items} />

      {lab.disclosure && (
        <p className="font-sans text-[13px] text-mute">
          Data note: <span className="text-ink">{lab.disclosure}</span>
        </p>
      )}

      <section className="border border-hairline bg-snow px-4 py-4">
        <p className="font-mono text-[10px] uppercase text-mute">Limitations (honest)</p>
        <ul className="mt-2 space-y-1 font-sans text-[13px] text-mute">
          <li>· Synthetic orders / late history — not fleet telemetry</li>
          <li>· ML not production-validated</li>
          <li>· OR-Tools time-limited — feasible ≠ globally optimal</li>
          <li>· OSRM may fall back to Haversine (always disclosed)</li>
        </ul>
      </section>

      <HistoryPanel items={lab.history} />
    </div>
  );
}
