import { X } from "lucide-react";
import type { ConstraintEvent, Order, RoutePlan, Stop, Unassigned } from "../types";
import { fmtClock, inr } from "../lib/format";
import { formatConstraintReason } from "../lib/constraintReason";

interface WhyThisRouteProps {
  stop: Stop | null;
  order: Order | Unassigned | null;
  vehicleId: string | null;
  route: RoutePlan | null;
  constraintLog: ConstraintEvent[];
  held: boolean;
  onClose: () => void;
  onHold: (held: boolean) => void;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-hairline py-1.5">
      <dt className="font-mono text-[10px] uppercase tracking-wide text-mute">{label}</dt>
      <dd className="text-right font-sans text-[13px] font-semibold text-ink">{value}</dd>
    </div>
  );
}

/** Explainability from real solver / ML fields only — no invented causality. */
export function WhyThisRoute({
  stop,
  order,
  vehicleId,
  route,
  constraintLog,
  held,
  onClose,
  onHold,
}: WhyThisRouteProps) {
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

  const deferredReason = constraintLog.find((c) => c.order_id === order.order_id)?.reason;
  const constraintStatus = stop
    ? stop.breach
      ? "Hard breach on stop"
      : stop.late
        ? "Late vs time window"
        : "Within capacity & window (assigned)"
    : deferredReason
      ? formatConstraintReason(deferredReason)
      : "Unassigned / not on a route";

  const capacity =
    route != null ? `${route.load} / ${route.capacity}` : "Reason unavailable from current solver output.";

  const twStatus =
    stop != null
      ? `${fmtClock(stop.tw_start)} — ${fmtClock(stop.tw_end)} · ETA ${fmtClock(stop.eta_min)}`
      : `${fmtClock(order.tw_start)} — ${fmtClock(order.tw_end)}`;

  const riskLevel =
    pct == null ? "Not scored yet" : high ? `HIGH — ${p!.toFixed(2)}` : pct >= 35 ? `ELEVATED — ${p!.toFixed(2)}` : `LOW — ${p!.toFixed(2)}`;

  return (
    <aside className="absolute left-3 top-12 z-20 flex max-h-[min(520px,calc(100%-3.5rem))] w-[min(100%-1.5rem,360px)] flex-col overflow-hidden border border-ink bg-snow shadow-card">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-hairline px-4 py-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-wide text-mute">Why this route?</p>
          <h2 className="mt-0.5 truncate font-sans text-[18px] font-semibold text-ink">{customer || order.order_id}</h2>
          <p className="font-mono text-[11px] text-mute">{order.order_id}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 border border-hairline p-1.5 text-mute hover:border-ink hover:text-ink"
          aria-label="Close explainability"
        >
          <X size={16} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <p className="font-mono text-[12px] leading-relaxed text-mute">{address || zoneName}</p>

        <dl className="mt-3">
          <Row label="Vehicle" value={vehicleId ?? "Unassigned"} />
          <Row label="Capacity" value={capacity} />
          <Row label="Time window" value={twStatus} />
          <Row label="Priority" value={order.priority.toUpperCase()} />
          <Row label="Late risk" value={riskLevel} />
          <Row
            label="Demand"
            value={String(stop?.demand ?? order.demand)}
          />
          <Row
            label="Sequence"
            value={stop != null ? String(stop.seq) : "Reason unavailable from current solver output."}
          />
          <Row label="Constraint" value={constraintStatus} />
          <Row
            label="Road source"
            value={route?.road_source ?? "Reason unavailable from current solver output."}
          />
        </dl>

        <div className="mt-4 border border-hairline bg-paper p-3">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-mute">Model signals</p>
          <p className={`mt-1 font-mono text-[20px] font-semibold tabular-nums ${high ? "text-coral" : "text-ink"}`}>
            {pct == null ? "—" : `${pct}% p(late)`}
          </p>
          <ul className="mt-2 space-y-1 font-sans text-[12px] text-mute">
            {(stop?.risk?.reasons?.length
              ? stop.risk.reasons
              : ["Run Optimize to attach ML risk scores to stops."]
            ).map((r) => (
              <li key={r}>· {r}</li>
            ))}
          </ul>
          <p className="mt-2 font-mono text-[10px] leading-snug text-mute">
            Signals correlate with late outcomes on synthetic history — not proven causes.
            {stop?.risk?.triage ? ` · triage: ${stop.risk.triage}` : ""}
          </p>
        </div>

        <div className="mt-3 border border-ink px-3 py-2.5">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-mute">Key concept</p>
          <p className="mt-1 font-sans text-[13px] text-ink">
            <span className="font-semibold">ML</span> predicts risk.{" "}
            <span className="font-semibold">OR-Tools</span> finds a feasible plan.
          </p>
          <p className="mt-1 font-sans text-[12px] text-mute">
            ML does not override hard capacity or time windows.
          </p>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px]">
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

        <button
          type="button"
          onClick={() => onHold(!held)}
          className="mt-3 w-full border border-ink bg-ink px-3 py-2.5 font-sans text-[13px] font-semibold text-snow hover:brightness-110"
        >
          {held ? "Release hold & re-plan" : "Hold for next wave"}
        </button>
      </div>
    </aside>
  );
}
