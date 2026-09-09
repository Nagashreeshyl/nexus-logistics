import { X } from "lucide-react";
import type { Order, Stop, Unassigned } from "../types";
import { fmtClock, inr } from "../lib/format";
import { HelpTip } from "./HelpTip";

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
    <aside className="absolute bottom-4 left-4 z-20 w-[min(100%-2rem,380px)] border border-ink bg-snow p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="sys">Stop // Risk</p>
          <h2 className="mt-1 font-display text-[26px] font-medium text-ink">{customer || order.order_id}</h2>
          <p className="font-mono text-[11px] text-mute">{order.order_id}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="border border-hairline p-2 text-mute hover:border-ink hover:text-ink"
          aria-label="Close inspector"
        >
          <X size={16} />
        </button>
      </div>
      <p className="mt-3 font-mono text-[12px] leading-relaxed text-mute">{address || zoneName}</p>
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
      <div className="mt-4 border border-hairline bg-paper p-4">
        <p className={`font-mono text-[22px] font-semibold tabular ${high ? "text-coral" : "text-ink"}`}>
          {pct == null ? "—" : `${pct}% late risk`}
        </p>
        <ul className="mt-2 space-y-1 font-mono text-[12px] text-mute">
          {(stop?.risk?.reasons ?? ["Run a plan to score this stop."]).map((r) => (
            <li key={r}>· {r}</li>
          ))}
        </ul>
        <p className="mt-3 sys">
          {stop?.risk?.triage === "intervene" ? "Triage: intervene" : "Triage: monitor"} · ML never relaxes
          capacity/windows
        </p>
        <p className="mt-1 font-mono text-[10px] text-mute">
          Late history for training is synthetic demonstration data.
        </p>
      </div>
      <HelpTip
        className="mt-3 w-full"
        label="Hold"
        tip="Persists in SQLite. Held orders leave the active solve until released — useful for high-risk or customer-not-home cases without breaking capacity/windows."
      >
        <button
          type="button"
          onClick={() => onHold(!held)}
          className="w-full border border-ink px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-ink hover:bg-ink hover:text-snow"
        >
          {held ? "Release hold & re-plan" : "Hold for next wave"}
        </button>
      </HelpTip>
    </aside>
  );
}
