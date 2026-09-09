import type { ConstraintEvent, Metrics, Unassigned } from "../types";
import { formatConstraintReason } from "../lib/constraintReason";

interface ExceptionStoryProps {
  partial: boolean;
  unassigned: Unassigned[];
  log: ConstraintEvent[];
  metrics: Metrics | null;
  heldCount: number;
}

/**
 * Compact Day-B / pressure narrative for judges — not an incident platform.
 */
export function ExceptionStory({ partial, unassigned, log, metrics, heldCount }: ExceptionStoryProps) {
  if (!partial && unassigned.length === 0) return null;

  const deferredCrit = unassigned.filter((u) => u.priority === "critical").length;
  const deferredNorm = unassigned.filter((u) => u.priority === "normal").length;
  const reasonSample = log.slice(0, 3).map((c) => formatConstraintReason(c.reason));

  return (
    <section className="border border-coral bg-snow px-4 py-4" aria-label="Exception handling">
      <p className="font-sans text-[12px] font-semibold uppercase tracking-wide text-coral">Exception path</p>
      <h3 className="mt-1 font-sans text-[18px] font-semibold text-ink">
        Constraint pressure → partial plan → deferred work
      </h3>
      <ol className="mt-3 grid gap-2 font-sans text-[13px] text-mute sm:grid-cols-2 lg:grid-cols-4">
        <li>
          <span className="font-semibold text-ink">1. Pressure</span>
          <br />
          Fleet cannot serve every stop inside capacity + windows.
        </li>
        <li>
          <span className="font-semibold text-ink">2. Protect</span>
          <br />
          Criticals served: {metrics?.criticals_served ?? "—"} · Deferred criticals: {deferredCrit}
        </li>
        <li>
          <span className="font-semibold text-ink">3. Defer</span>
          <br />
          {deferredNorm} normal stops deferred
          {reasonSample.length ? ` (${reasonSample[0]})` : ""}.
        </li>
        <li>
          <span className="font-semibold text-ink">4. Operator</span>
          <br />
          Inspect list → hold ({heldCount} held) → re-solve. Hard rules stay intact.
        </li>
      </ol>
    </section>
  );
}
