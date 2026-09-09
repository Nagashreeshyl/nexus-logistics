import type { ConstraintEvent } from "../types";
import { formatConstraintReason } from "../lib/constraintReason";

interface Props {
  items: ConstraintEvent[];
}

export function ConstraintLog({ items }: Props) {
  if (!items.length) return null;
  return (
    <section className="border border-hairline bg-snow p-4">
      <p className="font-sans text-[12px] font-semibold uppercase tracking-wide text-ink">Constraint log</p>
      <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto">
        {items.map((c, i) => (
          <li key={`${c.order_id}-${i}`} className="font-sans text-[12px] text-mute">
            <span className="font-mono text-ink">{c.order_id}</span> — {formatConstraintReason(c.reason)}
          </li>
        ))}
      </ul>
    </section>
  );
}
