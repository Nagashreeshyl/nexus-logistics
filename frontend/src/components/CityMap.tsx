import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RoutePlan, ScenarioDetail, Solution } from "../types";
import { vehicleColor, vehicleVisual } from "../lib/vehicleStyle";
import { MapLegend } from "./MapLegend";

/** Matches backend RiskModel triage threshold (intervene if p_late ≥ 0.55). */
export const HIGH_RISK_P = 0.55;

interface CityMapProps {
  scenario: ScenarioDetail | null;
  solution: Solution | null;
  selectedId: string | null;
  /** Sticky vehicle focus (click) — dims other routes. */
  focusVehicle: string | null;
  /** Transient hover highlight from vehicle rail. */
  hoverVehicle: string | null;
  playMin: number | null;
  unavailableVehicleIds?: string[];
  /** Hide OSM badge / tighter chrome for dual-pane compare. */
  compact?: boolean;
  onSelect: (orderId: string) => void;
  onFocusVehicle?: (vehicleId: string | null) => void;
}

function vehicleAtTime(
  depot: [number, number],
  route: RoutePlan,
  playMin: number,
): { lat: number; lon: number } {
  const stops = [...route.stops].sort((a, b) => a.eta_min - b.eta_min);
  if (!stops.length) return { lat: depot[0], lon: depot[1] };
  const startT = Math.min(route.shift_start, stops[0].eta_min - 15);
  if (playMin <= startT) return { lat: depot[0], lon: depot[1] };
  let prevLat = depot[0];
  let prevLon = depot[1];
  let prevT = startT;
  for (const stop of stops) {
    if (playMin >= stop.eta_min) {
      prevLat = stop.lat;
      prevLon = stop.lon;
      prevT = stop.eta_min;
      continue;
    }
    const span = Math.max(1, stop.eta_min - prevT);
    const f = Math.min(1, Math.max(0, (playMin - prevT) / span));
    return {
      lat: prevLat + (stop.lat - prevLat) * f,
      lon: prevLon + (stop.lon - prevLon) * f,
    };
  }
  const last = stops[stops.length - 1];
  return { lat: last.lat, lon: last.lon };
}

function stopMarkerHtml(opts: {
  critical: boolean;
  highRisk: boolean;
  deferred: boolean;
  completed: boolean;
  selected: boolean;
  color: string;
  pLate: number | null;
}): string {
  const { critical, highRisk, deferred, completed, selected, color, pLate } = opts;
  const size = selected ? 22 : 18;
  const border = selected ? "3px solid #F47C59" : "2px solid #0A0A0A";
  const shape = critical
    ? `width:0;height:0;border-left:${size / 2}px solid transparent;border-right:${size / 2}px solid transparent;border-bottom:${size}px solid ${deferred ? "#F47C59" : color};box-shadow:none;`
    : `width:${size}px;height:${size}px;border-radius:999px;background:${deferred ? "#F47C59" : "#F7F6F2"};border:${border};box-shadow:inset 0 0 0 3px ${deferred ? "#F47C59" : color};`;

  const badge =
    deferred
      ? `<span style="position:absolute;right:-6px;top:-8px;font:800 12px Outfit,sans-serif;color:#F47C59;text-shadow:0 0 2px #fff">×</span>`
      : completed
        ? `<span style="position:absolute;right:-6px;top:-8px;font:800 12px Outfit,sans-serif;color:#0A0A0A;text-shadow:0 0 2px #fff">✓</span>`
        : highRisk
          ? `<span style="position:absolute;right:-5px;top:-9px;font:800 13px Outfit,sans-serif;color:#F47C59;text-shadow:0 0 2px #fff" title="p_late ${pLate?.toFixed(2) ?? ""}">!</span>`
          : "";

  return `<div style="position:relative;width:${size}px;height:${size}px">${
    critical
      ? `<div style="${shape}"></div>`
      : `<div style="${shape}"></div>`
  }${badge}</div>`;
}

export function CityMap({
  scenario,
  solution,
  selectedId,
  focusVehicle,
  hoverVehicle,
  playMin,
  unavailableVehicleIds = [],
  compact = false,
  onSelect,
  onFocusVehicle,
}: CityMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const playLayerRef = useRef<L.LayerGroup | null>(null);
  const fittedKey = useRef("");
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const activeFocus = focusVehicle || hoverVehicle;
  const unavailable = new Set(unavailableVehicleIds);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { scrollWheelZoom: true }).setView([12.9716, 77.5946], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    playLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const t = window.setTimeout(() => map.invalidateSize(), 200);
    return () => {
      window.clearTimeout(t);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer || !scenario) return;
    layer.clearLayers();
    const bounds: L.LatLngExpression[] = [[scenario.depot[0], scenario.depot[1]]];

    if (solution) {
      for (const route of solution.routes) {
        const down = unavailable.has(route.vehicle_id);
        const dim = Boolean(activeFocus && activeFocus !== route.vehicle_id) || down;
        const vis = vehicleVisual(route.vehicle_id);
        const latlngs = route.polyline.map((p) => [p[0], p[1]] as L.LatLngExpression);
        if (latlngs.length > 1) {
          L.polyline(latlngs, {
            color: down ? "#9A9A9A" : vis.color,
            weight: activeFocus === route.vehicle_id ? 7 : down ? 3 : 4,
            opacity: dim ? 0.16 : down ? 0.35 : 0.92,
            dashArray: vis.dashArray ? vis.dashArray.join(" ") : undefined,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(layer);
        }
      }
    }

    // Unavailable vans with no current route still get a muted depot tick later if needed.
    for (const vid of unavailableVehicleIds) {
      if (solution?.routes.some((r) => r.vehicle_id === vid)) continue;
      // no polyline — legend marks them unavailable
    }

    L.circleMarker([scenario.depot[0], scenario.depot[1]], {
      radius: 10,
      color: "#0A0A0A",
      fillColor: "#92CFF2",
      fillOpacity: 1,
      weight: 2,
    })
      .bindTooltip(scenario.depot_address || "Depot")
      .addTo(layer);

    const assigned = new Map<
      string,
      { vid: string; late: boolean; breach: boolean; eta: number; pLate: number | null }
    >();
    if (solution) {
      for (const r of solution.routes) {
        for (const s of r.stops) {
          assigned.set(s.order_id, {
            vid: r.vehicle_id,
            late: s.late,
            breach: s.breach,
            eta: s.eta_min,
            pLate: s.risk?.p_late ?? null,
          });
        }
      }
    }
    const deferred = new Set(solution?.unassigned.map((u) => u.order_id) ?? []);

    for (const order of scenario.orders) {
      bounds.push([order.lat, order.lon]);
      const meta = assigned.get(order.order_id);
      const isDef = deferred.has(order.order_id);
      const played = playMin != null && meta != null && meta.eta <= playMin;
      const pLate = meta?.pLate ?? null;
      const highRisk = pLate != null && pLate >= HIGH_RISK_P;
      const color =
        isDef || meta?.late || meta?.breach
          ? "#F47C59"
          : meta
            ? vehicleColor(meta.vid)
            : "#0A0A0A";

      const icon = L.divIcon({
        className: "",
        html: stopMarkerHtml({
          critical: order.priority === "critical",
          highRisk: highRisk && !isDef,
          deferred: isDef,
          completed: Boolean(played && meta && !isDef),
          selected: selectedId === order.order_id,
          color,
          pLate,
        }),
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const tip = [
        order.order_id,
        order.customer,
        order.priority === "critical" ? "CRITICAL" : "normal",
        isDef ? "DEFERRED" : "",
        meta?.late ? "LATE" : "",
        highRisk && pLate != null ? `risk ${pLate.toFixed(2)}` : "",
        played ? "COMPLETED" : "",
      ]
        .filter(Boolean)
        .join(" · ");

      L.marker([order.lat, order.lon], { icon, riseOnHover: true })
        .bindTooltip(tip)
        .on("click", () => onSelectRef.current(order.order_id))
        .addTo(layer);
    }

    const fitKey = `${scenario.id}:${solution?.mode ?? "none"}:${solution?.routes.length ?? 0}:${unavailableVehicleIds.join(",")}`;
    if (bounds.length > 1 && fittedKey.current !== fitKey) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [28, 28], maxZoom: 13 });
      fittedKey.current = fitKey;
    }
  }, [scenario, solution, selectedId, activeFocus, playMin, unavailableVehicleIds, unavailable]);

  useEffect(() => {
    const playLayer = playLayerRef.current;
    if (!playLayer || !scenario || !solution || playMin == null) {
      playLayer?.clearLayers();
      return;
    }
    playLayer.clearLayers();
    const depot: [number, number] = [scenario.depot[0], scenario.depot[1]];
    for (const route of solution.routes) {
      if (!route.stops.length) continue;
      if (unavailable.has(route.vehicle_id)) continue;
      if (activeFocus && activeFocus !== route.vehicle_id) continue;
      const color = vehicleColor(route.vehicle_id);
      const pos = vehicleAtTime(depot, route, playMin);
      const icon = L.divIcon({
        className: "",
        html: `<div style="
          display:flex;align-items:center;gap:4px;
          background:${color};color:#fff;border:2px solid #0A0A0A;
          padding:3px 7px;font:700 11px Outfit,sans-serif;
          box-shadow:0 2px 6px rgba(0,0,0,.18);white-space:nowrap;
        ">${route.vehicle_id}</div>`,
        iconSize: [72, 24],
        iconAnchor: [36, 12],
      });
      L.marker([pos.lat, pos.lon], { icon, interactive: false, zIndexOffset: 900 }).addTo(playLayer);
      L.circleMarker([pos.lat, pos.lon], {
        radius: 5,
        color: "#0A0A0A",
        fillColor: color,
        fillOpacity: 1,
        weight: 2,
      }).addTo(playLayer);
    }
  }, [scenario, solution, playMin, activeFocus, unavailable]);

  const legendVehicleIds =
    scenario?.vehicles.map((v) => v.vehicle_id) ??
    solution?.routes.map((r) => r.vehicle_id) ??
    [];

  return (
    <div className={`relative h-full overflow-hidden border border-hairline bg-snow ${compact ? "min-h-[360px]" : "min-h-[480px]"}`}>
      <div ref={ref} className={`h-full w-full ${compact ? "min-h-[360px]" : "min-h-[480px]"}`} />
      {!compact && (
        <p className="pointer-events-none absolute bottom-3 left-3 z-[500] border border-ink bg-snow px-3 py-1 font-mono text-[10px] uppercase tracking-wide text-ink">
          OSM · Bengaluru
        </p>
      )}
      {!compact && (
        <MapLegend
          vehicleIds={legendVehicleIds}
          focusVehicle={focusVehicle}
          unavailableVehicleIds={unavailableVehicleIds}
          onSelectVehicle={onFocusVehicle}
        />
      )}
      {playMin != null && (
        <p className="pointer-events-none absolute bottom-3 right-3 z-[500] border border-ink bg-snow px-3 py-1 font-mono text-[12px] font-semibold">
          Play · {String(Math.floor(playMin / 60)).padStart(2, "0")}:{String(playMin % 60).padStart(2, "0")}
        </p>
      )}
    </div>
  );
}
