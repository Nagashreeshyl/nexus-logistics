import type { ConstraintEvent } from "../types";

interface Props {
  items: ConstraintEvent[];
}

export function ConstraintLog({ items }: Props) {
  if (!items.length) return null;
  return (
    <section className="border border-hairline bg-snow p-4">
      <p className="sys text-ink">Sys.log // Constraints</p>
      <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto">
        {items.map((c, i) => (
          <li key={`${c.order_id}-${i}`} className="font-mono text-[12px] text-mute">
            <span className="text-ink">{c.order_id}</span> — {c.reason}
          </li>
        ))}
      </ul>
    </section>
  );
}
