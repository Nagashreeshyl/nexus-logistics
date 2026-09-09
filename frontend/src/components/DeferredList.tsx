import type { ConstraintEvent, Unassigned } from "../types";
import { ShapeMark } from "./ShapeMark";
import { fmtClock } from "../lib/format";
import { formatConstraintReason } from "../lib/constraintReason";

interface DeferredListProps {
  items: Unassigned[];
  reasons?: ConstraintEvent[];
  onSelect: (id: string) => void;
}

export function DeferredList({ items, reasons = [], onSelect }: DeferredListProps) {
  const reasonOf = Object.fromEntries(reasons.map((r) => [r.order_id, r.reason]));
  return (
    <section className="border border-hairline bg-snow p-4">
      <div className="flex items-center gap-2">
        <ShapeMark name="exception" className="h-3.5 w-3.5 text-coral" />
        <h3 className="font-sans text-[12px] font-semibold uppercase tracking-wide text-ink">Deferred / unassigned</h3>
      </div>
      <p className="mt-1 font-sans text-[11px] text-mute">
        Inspect → hold/release → re-solve. Criticals are protected when capacity runs out.
      </p>
      {items.length === 0 ? (
        <p className="mt-2 font-mono text-[12px] text-mute">0 deferred</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((u) => (
            <li key={u.order_id}>
              <button
                type="button"
                onClick={() => onSelect(u.order_id)}
                className="flex w-full items-start justify-between gap-2 border border-transparent px-2 py-1.5 text-left text-[13px] hover:border-hairline hover:bg-paper"
              >
                <span className="min-w-0">
                  <span className="text-ink">{u.customer || u.order_id}</span>
                  <span className="block font-mono text-[11px] text-mute">
                    {u.zone_name || u.zone}
                    {u.priority === "critical" ? " · CRITICAL" : ""}
                  </span>
                  {reasonOf[u.order_id] && (
                    <span className="mt-0.5 block font-sans text-[11px] leading-snug text-coral">
                      {formatConstraintReason(reasonOf[u.order_id])}
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-[11px] text-coral">due {fmtClock(u.tw_end)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
