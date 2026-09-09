import { useMemo, useState } from "react";
import type { Order, Solution } from "../types";
import { fmtClock, inr } from "../lib/format";

interface OrderBoardProps {
  orders: Order[];
  solution: Solution | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function OrderBoard({ orders, solution, selectedId, onSelect }: OrderBoardProps) {
  const [q, setQ] = useState("");
  const assigned = useMemo(() => {
    const m = new Map<string, { van: string; late: boolean; eta: number }>();
    if (!solution) return m;
    for (const r of solution.routes) {
      for (const s of r.stops) m.set(s.order_id, { van: r.vehicle_id, late: s.late, eta: s.eta_min });
    }
    return m;
  }, [solution]);
  const deferred = new Set(solution?.unassigned.map((u) => u.order_id) ?? []);
  const rows = orders.filter((o) => {
    const blob = `${o.order_id} ${o.customer} ${o.address} ${o.zone_name} ${o.sku}`.toLowerCase();
    return blob.includes(q.toLowerCase());
  });

  return (
    <section className="border border-hairline bg-snow p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-[22px] font-medium text-ink">Order board · {orders.length}</h3>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search customer, address, SKU…"
          className="w-full max-w-xs border border-hairline bg-paper px-3 py-2 font-mono text-[12px] text-ink outline-none placeholder:text-mute focus:border-ink"
        />
      </div>
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead className="sticky top-0 bg-snow font-mono text-[10px] uppercase tracking-wide text-mute">
            <tr>
              <th className="py-2 pr-3">Order</th>
              <th className="py-2 pr-3">Customer</th>
              <th className="py-2 pr-3">Area</th>
              <th className="py-2 pr-3">Window</th>
              <th className="py-2 pr-3">COD</th>
              <th className="py-2 pr-3">Van</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const a = assigned.get(o.order_id);
              const status = deferred.has(o.order_id) ? "Deferred" : a?.late ? "Late" : a ? "On van" : "Open";
              return (
                <tr
                  key={o.order_id}
                  onClick={() => onSelect(o.order_id)}
                  className={`cursor-pointer border-t border-hairline ${
                    selectedId === o.order_id ? "bg-lavender" : "hover:bg-lavender/70"
                  }`}
                >
                  <td className="py-2 pr-3 font-mono text-[11px] text-ink">
                    {o.order_id}
                    {o.priority === "critical" ? " ★" : ""}
                  </td>
                  <td className="py-2 pr-3 text-ink">{o.customer}</td>
                  <td className="py-2 pr-3 font-mono text-[11px] text-mute">{o.zone_name || o.zone}</td>
                  <td className="py-2 pr-3 font-mono text-[11px] text-mute">
                    {fmtClock(o.tw_start)}–{fmtClock(o.tw_end)}
                  </td>
                  <td className="py-2 pr-3 text-ink">{inr(o.cod_inr)}</td>
                  <td className="py-2 pr-3 text-ink">{a?.van ?? "—"}</td>
                  <td className={`py-2 font-mono text-[11px] ${status === "Late" || status === "Deferred" ? "text-coral" : "text-ink"}`}>
                    {status}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
