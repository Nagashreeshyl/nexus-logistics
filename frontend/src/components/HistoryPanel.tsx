interface HistoryItem {
  id: number;
  mode: string;
  travel_source: string;
  created_at: string;
  metrics: {
    late_count: number;
    distance_km: number;
    hard_breaches: number;
    unassigned_count: number;
  };
}

interface Props {
  items: HistoryItem[];
}

export function HistoryPanel({ items }: Props) {
  return (
    <section className="border border-hairline bg-snow p-4">
      <p className="sys text-ink">Sys.db // Solve history</p>
      {items.length === 0 ? (
        <p className="mt-2 font-mono text-[12px] text-mute">No runs yet — baseline or optimize to persist.</p>
      ) : (
        <ul className="mt-3 max-h-44 space-y-2 overflow-y-auto">
          {items.map((h) => (
            <li key={h.id} className="border-t border-hairline pt-2 font-mono text-[11px] text-mute first:border-t-0 first:pt-0">
              <span className="text-ink">#{h.id} {h.mode}</span> · {h.travel_source} · late {h.metrics.late_count} ·{" "}
              {h.metrics.distance_km.toFixed(1)} km · def {h.metrics.unassigned_count}
              <span className="block text-[10px]">{h.created_at}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
