import { X } from "lucide-react";
import type { Order, Stop, Unassigned } from "../types";
import { fmtClock, inr } from "../lib/format";

interface RiskInspectorProps {
  stop: Stop | null;
  order: Order | Unassigned | null;
  vehicleId: string | null;
  held: boolean;
  onClose: () => void;
  onHold: (held: boolean) => void;
}

export function RiskInspector({ stop, order, vehicleId, held, onClose, onHold }: RiskInspectorProps) {
  if (!order) return null;
  const p = stop?.risk?.p_late;
  const pct = p != null ? Math.round(p * 100) : null;
  const high = (pct ?? 0) >= 55;
  const customer = "customer" in order ? order.customer : "";
  const address = "address" in order ? order.address : "";
  const sku = "sku" in order ? order.sku : "";
  const phone = "phone" in order ? order.phone : "";
  const zoneName = ("zone_name" in order && order.zone_name) || order.zone;
  const cod = "cod_inr" in order ? order.cod_inr : 0;

  return (
    <aside className="absolute left-3 top-12 z-20 flex max-h-[min(420px,calc(100%-3.5rem))] w-[min(100%-1.5rem,340px)] flex-col overflow-hidden border border-ink bg-snow shadow-card">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-hairline px-4 py-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-wide text-mute">Stop · risk</p>
          <h2 className="mt-0.5 truncate font-sans text-[18px] font-semibold text-ink">{customer || order.order_id}</h2>
          <p className="font-mono text-[11px] text-mute">{order.order_id}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 border border-hairline p-1.5 text-mute hover:border-ink hover:text-ink"
          aria-label="Close inspector"
        >
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <p className="font-mono text-[12px] leading-relaxed text-mute">{address || zoneName}</p>
        <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px]">
          <div>
            <dt className="text-mute">Window</dt>
            <dd className="text-ink">
              {fmtClock(order.tw_start)}–{fmtClock(order.tw_end)}
            </dd>
          </div>
          <div>
            <dt className="text-mute">Van</dt>
            <dd className="text-ink">{vehicleId ?? "Unassigned"}</dd>
          </div>
          <div>
            <dt className="text-mute">SKU / COD</dt>
            <dd className="text-ink">
              {sku || "—"} · {inr(cod)}
            </dd>
          </div>
          <div>
            <dt className="text-mute">Phone</dt>
            <dd className="text-ink">{phone || "—"}</dd>
          </div>
        </dl>

        <div className="mt-3 border border-hairline bg-paper p-3">
          <p className={`font-mono text-[20px] font-semibold tabular-nums ${high ? "text-coral" : "text-ink"}`}>
            {pct == null ? "—" : `${pct}% late risk`}
          </p>
          <ul className="mt-2 space-y-1 font-sans text-[12px] text-mute">
            {(stop?.risk?.reasons ?? ["Run a plan to score this stop."]).map((r) => (
              <li key={r}>· {r}</li>
            ))}
          </ul>
          <p className="mt-2 font-mono text-[10px] text-mute">
            {stop?.risk?.triage === "intervene" ? "Triage: intervene" : "Triage: monitor"} · ML never relaxes
            capacity/windows
          </p>
        </div>

        <button
          type="button"
          onClick={() => onHold(!held)}
          className="mt-3 w-full border border-ink bg-ink px-3 py-2.5 font-sans text-[13px] font-semibold text-snow hover:brightness-110"
        >
          {held ? "Release hold & re-plan" : "Hold for next wave"}
        </button>
        <p className="mt-2 font-sans text-[11px] leading-snug text-mute">
          Hold keeps this stop out of the next solve (SQLite) — useful for high-risk or customer-not-home without
          breaking capacity or windows.
        </p>
      </div>
    </aside>
  );
}
