interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  detail?: string;
}

interface Jp019ChecklistProps {
  items: ChecklistItem[];
}

/** JP-019 outcomes — checked only from live Lab evidence. */
export function Jp019Checklist({ items }: Jp019ChecklistProps) {
  const done = items.filter((i) => i.done).length;
  return (
    <section className="border border-hairline bg-snow px-4 py-4" aria-label="JP-019 checklist">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-mute">JP-019 evidence</p>
          <h3 className="mt-1 font-sans text-[16px] font-semibold text-ink">Problem outcomes proven this session</h3>
        </div>
        <p className="font-mono text-[12px] text-mute">
          {done}/{items.length} checked
        </p>
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={`flex items-start gap-3 border px-3 py-2 font-sans text-[13px] ${
              item.done ? "border-ink bg-paper" : "border-hairline text-mute"
            }`}
          >
            <span className="mt-0.5 font-mono text-[12px] font-bold" aria-hidden>
              {item.done ? "✓" : "·"}
            </span>
            <span>
              <span className="font-semibold text-ink">{item.label}</span>
              {item.detail ? <span className="mt-0.5 block font-mono text-[11px] text-mute">{item.detail}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
