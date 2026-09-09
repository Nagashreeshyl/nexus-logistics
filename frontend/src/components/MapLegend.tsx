import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { patternCss, vehicleVisual } from "../lib/vehicleStyle";

interface MapLegendProps {
  vehicleIds: string[];
  focusVehicle?: string | null;
  unavailableVehicleIds?: string[];
  onSelectVehicle?: (vehicleId: string | null) => void;
}

function StatusRow({ mark, label }: { mark: ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-2 font-sans text-[11px] text-ink">
      <span className="inline-flex h-4 w-5 shrink-0 items-center justify-center font-mono text-[12px] font-bold" aria-hidden>
        {mark}
      </span>
      <span className="text-mute">{label}</span>
    </li>
  );
}

/** Compact map legend — collapsible so it does not block the map. */
export function MapLegend({
  vehicleIds,
  focusVehicle = null,
  unavailableVehicleIds = [],
  onSelectVehicle,
}: MapLegendProps) {
  const [open, setOpen] = useState(false);
  const unavailable = new Set(unavailableVehicleIds);

  return (
    <aside
      className="pointer-events-auto absolute bottom-3 left-3 z-[500] max-w-[220px] border border-ink bg-snow/95 shadow-sm backdrop-blur-[2px]"
      aria-label="Map legend"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-paper"
        aria-expanded={open}
        title={open ? "Minimize legend" : "Expand legend"}
      >
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ink">Legend</span>
        <span className="inline-flex items-center gap-1 font-mono text-[10px] text-mute">
          {open ? "Hide" : "Show"}
          {open ? <ChevronDown size={14} aria-hidden /> : <ChevronUp size={14} aria-hidden />}
        </span>
      </button>

      {open && (
        <div className="border-t border-hairline px-3 py-2.5">
          <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-mute">Vehicles</p>
          <ul className="mt-1.5 space-y-1">
            {vehicleIds.length === 0 && (
              <li className="font-sans text-[11px] text-mute">Load a scenario to show vans</li>
            )}
            {vehicleIds.map((id) => {
              const vis = vehicleVisual(id);
              const down = unavailable.has(id);
              const focused = focusVehicle === id;
              const dim = Boolean(focusVehicle && !focused);
              return (
                <li key={id}>
                  <button
                    type="button"
                    disabled={!onSelectVehicle}
                    onClick={() => onSelectVehicle?.(focused ? null : id)}
                    className={`flex w-full items-center gap-2 text-left disabled:cursor-default ${
                      dim ? "opacity-35" : ""
                    } ${focused ? "bg-paper" : ""}`}
                    title={down ? `${id} unavailable` : `Focus ${id}`}
                  >
                    <span
                      className="inline-block h-0 w-10 shrink-0 border-t-2"
                      style={{
                        borderColor: down ? "#9A9A9A" : vis.color,
                        borderStyle: patternCss(vis.patternLabel),
                      }}
                      aria-hidden
                    />
                    <span
                      className={`font-mono text-[11px] font-semibold ${
                        down ? "text-mute line-through" : "text-ink"
                      }`}
                    >
                      {id}
                    </span>
                    <span className="ml-auto font-mono text-[9px] uppercase text-mute">
                      {down ? "down" : vis.patternLabel}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <p className="mt-2.5 border-t border-hairline pt-2 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-mute">
            Delivery status
          </p>
          <ul className="mt-1.5 space-y-1">
            <StatusRow
              mark={<span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-ink bg-snow" />}
              label="Normal"
            />
            <StatusRow mark={<span className="text-[13px] leading-none text-ink">◆</span>} label="Critical" />
            <StatusRow mark={<span className="text-coral">!</span>} label="High risk" />
            <StatusRow mark={<span className="text-ink">✓</span>} label="Completed" />
            <StatusRow mark={<span className="text-coral">×</span>} label="Deferred / failed" />
            <StatusRow mark={<span className="text-coral">⚠</span>} label="Breakdown / unavailable" />
          </ul>
        </div>
      )}
    </aside>
  );
}
