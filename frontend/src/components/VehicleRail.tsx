import type { RoutePlan } from "../types";
import { VEHICLE_COLORS } from "../types";
import { fmtClock } from "../lib/format";

interface VehicleRailProps {
  routes: RoutePlan[];
  hoverVehicle: string | null;
  onHover: (id: string | null) => void;
  onSelectStop: (orderId: string) => void;
  selectedId: string | null;
}

export function VehicleRail({ routes, hoverVehicle, onHover, onSelectStop, selectedId }: VehicleRailProps) {
  return (
    <div className="flex flex-col gap-3">
      {routes.map((route) => {
        const pct = Math.min(100, Math.round((route.load / Math.max(route.capacity, 1)) * 100));
        const color = VEHICLE_COLORS[route.vehicle_id] ?? "#0A0A0A";
        const active = hoverVehicle === route.vehicle_id;
        return (
          <article
            key={route.vehicle_id}
            className={`border bg-snow p-4 ${active ? "border-ink" : "border-hairline"}`}
            onMouseEnter={() => onHover(route.vehicle_id)}
            onMouseLeave={() => onHover(null)}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="sys">Van // {route.vehicle_id}</p>
                <h3 className="mt-1 font-display text-[22px] font-medium text-ink">{route.driver || route.vehicle_id}</h3>
                <p className="font-mono text-[11px] text-mute">
                  {route.plate}
                  {route.rating ? ` · ${route.rating.toFixed(1)}★` : ""}
                </p>
              </div>
              <span className="font-mono text-[11px] text-mute">
                {fmtClock(route.shift_start)}–{fmtClock(route.shift_end)}
              </span>
            </div>
            <div className="mt-3">
              <div className="mb-1 flex justify-between font-mono text-[11px] text-mute">
                <span>Load</span>
                <span className={route.capacity_breach ? "text-coral" : "text-ink"}>
                  {route.load}/{route.capacity}
                  {route.capacity_breach ? " BREACH" : ""}
                </span>
              </div>
              <div className="h-1 overflow-hidden bg-hairline">
                <div
                  className="h-full"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: route.capacity_breach ? "#F47C59" : color,
                  }}
                />
              </div>
            </div>
            <ol className="mt-4 max-h-52 space-y-1 overflow-y-auto">
              {route.stops.length === 0 && (
                <li className="font-sans text-[13px] text-mute">No stops yet. Run Naive plan or Smart optimize.</li>
              )}
              {route.stops.map((s) => (
                <li key={s.order_id}>
                  <button
                    type="button"
                    onClick={() => onSelectStop(s.order_id)}
                    className={`flex w-full items-center justify-between px-2 py-1.5 text-left text-[13px] ${
                      selectedId === s.order_id ? "bg-lavender text-ink" : "text-mute hover:bg-lavender hover:text-ink"
                    }`}
                  >
                    <span className="truncate pr-2">
                      {s.seq}. {s.customer || s.order_id}
                      {s.priority === "critical" ? " · CRITICAL" : ""}
                    </span>
                    <span className={`shrink-0 font-mono text-[11px] ${s.late || s.breach ? "text-coral" : "text-ink"}`}>
                      {fmtClock(s.eta_min)}
                      {s.late ? " LATE" : s.breach ? " BREACH" : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </article>
        );
      })}
    </div>
  );
}
