import type { RoutePlan } from "../types";
import { patternCss, vehicleColor, vehicleVisual } from "../lib/vehicleStyle";
import { fmtClock } from "../lib/format";

interface VehicleRailProps {
  routes: RoutePlan[];
  hoverVehicle: string | null;
  focusVehicle: string | null;
  unavailableVehicleIds?: string[];
  onHover: (id: string | null) => void;
  onFocus: (id: string | null) => void;
  onSelectStop: (orderId: string) => void;
  selectedId: string | null;
}

export function VehicleRail({
  routes,
  hoverVehicle,
  focusVehicle,
  unavailableVehicleIds = [],
  onHover,
  onFocus,
  onSelectStop,
  selectedId,
}: VehicleRailProps) {
  const unavailable = new Set(unavailableVehicleIds);
  return (
    <div className="flex flex-col gap-3">
      {routes.map((route) => {
        const pct = Math.min(100, Math.round((route.load / Math.max(route.capacity, 1)) * 100));
        const vis = vehicleVisual(route.vehicle_id);
        const color = vehicleColor(route.vehicle_id);
        const down = unavailable.has(route.vehicle_id);
        const focused = focusVehicle === route.vehicle_id;
        const hovered = hoverVehicle === route.vehicle_id;
        const dim = Boolean(focusVehicle && !focused);
        return (
          <article
            key={route.vehicle_id}
            className={`border bg-snow p-4 transition ${
              focused ? "border-ink ring-1 ring-ink" : hovered ? "border-ink" : "border-hairline"
            } ${dim || down ? "opacity-45" : ""}`}
            onMouseEnter={() => onHover(route.vehicle_id)}
            onMouseLeave={() => onHover(null)}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <button
                  type="button"
                  onClick={() => onFocus(focused ? null : route.vehicle_id)}
                  className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-mute hover:text-ink"
                  title={focused ? "Clear vehicle focus" : "Focus this van on the map"}
                >
                  <span
                    className="inline-block h-0 w-8 border-t-2"
                    style={{ borderColor: down ? "#9A9A9A" : color, borderStyle: patternCss(vis.patternLabel) }}
                    aria-hidden
                  />
                  Van · {route.vehicle_id}
                  {down ? <span className="text-coral"> · UNAVAILABLE</span> : null}
                  {focused ? <span className="text-ink"> · FOCUSED</span> : null}
                </button>
                <h3 className="mt-1 font-sans text-[20px] font-semibold text-ink">{route.driver || route.vehicle_id}</h3>
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
                      selectedId === s.order_id ? "bg-paper text-ink" : "text-mute hover:bg-paper hover:text-ink"
                    }`}
                  >
                    <span className="truncate pr-2">
                      {s.seq}. {s.customer || s.order_id}
                      {s.priority === "critical" ? (
                        <span className="ml-1 font-semibold text-coral">CRITICAL</span>
                      ) : null}
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
