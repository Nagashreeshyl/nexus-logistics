import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RoutePlan, ScenarioDetail, Solution } from "../types";
import { vehicleVisual } from "../lib/vehicleStyle";

export interface LabMapProps {
  scenario: ScenarioDetail | null;
  solution: Solution | null;
  selectedId: string | null;
  focusVehicle: string | null;
  excludedVehicles?: string[];
  disruptedOrderIds?: string[];
  /** Simulation clock (minutes from midnight). When set, vans animate along their routes. */
  playMin?: number | null;
  onSelect: (orderId: string) => void;
}

function riskHigh(p: number | undefined): boolean {
  return (p ?? 0) >= 0.55;
}

function vehicleAtTime(
  depot: [number, number],
  route: RoutePlan,
  playMin: number,
): { lat: number; lon: number; done: boolean; nextLabel: string } {
  const stops = [...route.stops].sort((a, b) => a.eta_min - b.eta_min);
  if (!stops.length) {
    return { lat: depot[0], lon: depot[1], done: true, nextLabel: "idle" };
  }
  const startT = Math.min(route.shift_start, stops[0].eta_min - 15);
  if (playMin <= startT) {
    return { lat: depot[0], lon: depot[1], done: false, nextLabel: `→ ${stops[0].order_id}` };
  }
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
      done: false,
      nextLabel: `→ ${stop.order_id}`,
    };
  }
  const last = stops[stops.length - 1];
  return { lat: last.lat, lon: last.lon, done: true, nextLabel: "done" };
}

/**
 * Light-theme Lab map: distinct vehicle routes (color + dash), shaped stops,
 * breakdown state, and play-day van markers.
 */
export function LabMap({
  scenario,
  solution,
  selectedId,
  focusVehicle,
  excludedVehicles = [],
  disruptedOrderIds = [],
  playMin = null,
  onSelect,
}: LabMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const playLayerRef = useRef<L.LayerGroup | null>(null);
  const fittedRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { scrollWheelZoom: true, zoomControl: true }).setView(
      [12.9716, 77.5946],
      12,
    );
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    playLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const t = window.setTimeout(() => map.invalidateSize(), 180);
    return () => {
      window.clearTimeout(t);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    fittedRef.current = false;
  }, [scenario?.id, solution?.mode, solution?.routes.length]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer || !scenario) return;
    layer.clearLayers();
    const bounds: L.LatLngExpression[] = [[scenario.depot[0], scenario.depot[1]]];
    const excluded = new Set(excludedVehicles);
    const disrupted = new Set(disruptedOrderIds);

    if (solution) {
      for (const route of solution.routes) {
        if (!route.stops.length && route.polyline.length < 2) continue;
        const vis = vehicleVisual(route.vehicle_id);
        const isExcluded = excluded.has(route.vehicle_id);
        const dim = Boolean(focusVehicle && focusVehicle !== route.vehicle_id) || isExcluded;
        const latlngs = route.polyline.map((p) => [p[0], p[1]] as L.LatLngExpression);
        if (latlngs.length > 1) {
          L.polyline(latlngs, {
            color: isExcluded ? "#F47C59" : vis.color,
            weight: focusVehicle === route.vehicle_id ? 6 : isExcluded ? 3 : 4,
            opacity: isExcluded ? 0.28 : dim ? 0.18 : 0.95,
            dashArray: isExcluded ? "4 6" : vis.dashArray ? vis.dashArray.join(" ") : undefined,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(layer);
        }
        if (
          !isExcluded &&
          playMin == null &&
          latlngs.length >= 2 &&
          (!focusVehicle || focusVehicle === route.vehicle_id)
        ) {
          const mid = latlngs[Math.floor(latlngs.length / 2)] as [number, number];
          const icon = L.divIcon({
            className: "",
            html: `<div style="
              display:flex;align-items:center;gap:4px;
              background:#fff;border:2px solid ${vis.color};border-radius:4px;
              padding:2px 6px;font:600 11px Outfit,sans-serif;color:#0A0A0A;
              box-shadow:0 1px 4px rgba(0,0,0,.12);white-space:nowrap;
            "><span style="width:8px;height:8px;background:${vis.color};border-radius:1px;display:inline-block"></span>${route.vehicle_id}</div>`,
            iconSize: [72, 22],
            iconAnchor: [36, 11],
          });
          L.marker(mid, { icon, interactive: false, opacity: dim ? 0.25 : 1 }).addTo(layer);
        }
      }
    }

    excludedVehicles.forEach((vid, i) => {
      const vis = vehicleVisual(vid);
      const lat = scenario.depot[0] + 0.004 + i * 0.002;
      const lon = scenario.depot[1] - 0.006 - i * 0.002;
      const icon = L.divIcon({
        className: "",
        html: `<div style="
          display:flex;align-items:center;gap:4px;
          background:#FFF5F2;border:2px solid #F47C59;border-radius:4px;
          padding:3px 8px;font:700 11px Outfit,sans-serif;color:#0A0A0A;
          box-shadow:0 1px 4px rgba(0,0,0,.1);
        ">⚠ ${vid} UNAVAILABLE</div>`,
        iconSize: [150, 26],
        iconAnchor: [75, 13],
      });
      L.marker([lat, lon], { icon, interactive: false }).addTo(layer);
      L.circleMarker([lat, lon], {
        radius: 8,
        color: vis.color,
        fillColor: "#F47C59",
        fillOpacity: 0.35,
        weight: 2,
        dashArray: "4 3",
      }).addTo(layer);
    });

    L.circleMarker([scenario.depot[0], scenario.depot[1]], {
      radius: 11,
      color: "#0A0A0A",
      fillColor: "#92CFF2",
      fillOpacity: 1,
      weight: 2,
    })
      .bindTooltip(scenario.depot_address || "Depot")
      .addTo(layer);

    const stopMeta = new Map<
      string,
      { vid: string; late: boolean; breach: boolean; eta: number; pLate: number; reasons: string[]; critical: boolean }
    >();
    if (solution) {
      for (const r of solution.routes) {
        for (const s of r.stops) {
          stopMeta.set(s.order_id, {
            vid: r.vehicle_id,
            late: s.late,
            breach: s.breach,
            eta: s.eta_min,
            pLate: s.risk?.p_late ?? 0,
            reasons: s.risk?.reasons ?? [],
            critical: s.priority === "critical",
          });
        }
      }
    }
    const deferred = new Set(solution?.unassigned.map((u) => u.order_id) ?? []);

    for (const order of scenario.orders) {
      bounds.push([order.lat, order.lon]);
      const meta = stopMeta.get(order.order_id);
      const isDef = deferred.has(order.order_id);
      const isCrit = order.priority === "critical";
      const isHigh = riskHigh(meta?.pLate);
      const isDisrupt = disrupted.has(order.order_id);
      const dimStop = Boolean(focusVehicle && meta && meta.vid !== focusVehicle && !isDef);
      const completed = playMin != null && meta != null && meta.eta <= playMin;

      let fill = completed ? (meta ? vehicleVisual(meta.vid).color : "#0A0A0A") : "#F7F6F2";
      let stroke = "#0A0A0A";
      if (meta) stroke = vehicleVisual(meta.vid).color;
      if (isDef) {
        stroke = "#F47C59";
        fill = "#F47C59";
      } else if (isHigh && !completed) {
        fill = "#FFE8E0";
      } else if (isCrit && !completed) {
        fill = "#FFF0E8";
      }

      const selected = selectedId === order.order_id;
      const radius = selected ? 12 : completed ? 9 : isCrit || isHigh ? 9 : 7;

      if (isCrit && !isDef) {
        const icon = L.divIcon({
          className: "",
          html: `<div style="
            width:14px;height:14px;background:${fill};border:2.5px solid ${stroke};
            transform:rotate(45deg);opacity:${dimStop ? 0.25 : 1};
            box-shadow:${selected ? "0 0 0 3px rgba(244,124,89,.35)" : "none"};
          "></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });
        const m = L.marker([order.lat, order.lon], { icon, opacity: dimStop ? 0.3 : 1 });
        m.bindTooltip(
          ["◆ " + order.order_id, order.customer, "CRITICAL", completed ? "✓ served" : "", meta ? meta.vid : ""]
            .filter(Boolean)
            .join(" · "),
        );
        m.on("click", () => onSelectRef.current(order.order_id));
        m.addTo(layer);
      } else {
        const marker = L.circleMarker([order.lat, order.lon], {
          radius,
          color: stroke,
          fillColor: fill,
          fillOpacity: dimStop ? 0.25 : 1,
          weight: isHigh ? 3.5 : 2.5,
          opacity: dimStop ? 0.3 : 1,
        });
        const prefix = isDef ? "× " : completed ? "✓ " : isHigh ? "! " : "○ ";
        marker.bindTooltip(
          [prefix + order.order_id, order.customer, meta ? meta.vid : "", isDef ? "DEFERRED" : "", isDisrupt ? "DISRUPTED" : ""]
            .filter(Boolean)
            .join(" · "),
        );
        marker.on("click", () => onSelectRef.current(order.order_id));
        marker.addTo(layer);
      }

      if (isHigh && !isDef && !completed) {
        const bang = L.divIcon({
          className: "",
          html: `<div style="font:800 12px Outfit,sans-serif;color:#F47C59;text-shadow:0 0 2px #fff">!</div>`,
          iconSize: [10, 14],
          iconAnchor: [-6, 16],
        });
        L.marker([order.lat, order.lon], { icon: bang, interactive: false, opacity: dimStop ? 0.25 : 1 }).addTo(
          layer,
        );
      }
    }

    if (!fittedRef.current && bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [36, 36], maxZoom: 13 });
      fittedRef.current = true;
    }
    window.setTimeout(() => map.invalidateSize(), 80);
  }, [scenario, solution, selectedId, focusVehicle, excludedVehicles, disruptedOrderIds, playMin]);

  // Moving van markers during play
  useEffect(() => {
    const playLayer = playLayerRef.current;
    if (!playLayer || !scenario || !solution || playMin == null) {
      playLayer?.clearLayers();
      return;
    }
    playLayer.clearLayers();
    const depot: [number, number] = [scenario.depot[0], scenario.depot[1]];
    const excluded = new Set(excludedVehicles);

    for (const route of solution.routes) {
      if (excluded.has(route.vehicle_id)) continue;
      if (!route.stops.length) continue;
      if (focusVehicle && focusVehicle !== route.vehicle_id) continue;
      const vis = vehicleVisual(route.vehicle_id);
      const pos = vehicleAtTime(depot, route, playMin);
      const icon = L.divIcon({
        className: "",
        html: `<div style="
          display:flex;align-items:center;gap:5px;
          background:${vis.color};color:#fff;border:2px solid #0A0A0A;
          border-radius:6px;padding:4px 8px;
          font:700 12px Outfit,sans-serif;
          box-shadow:0 2px 8px rgba(0,0,0,.2);white-space:nowrap;
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          ${route.vehicle_id}
        </div>`,
        iconSize: [88, 28],
        iconAnchor: [44, 14],
      });
      L.marker([pos.lat, pos.lon], { icon, interactive: false, zIndexOffset: 800 }).addTo(playLayer);
      L.circleMarker([pos.lat, pos.lon], {
        radius: 6,
        color: "#0A0A0A",
        fillColor: vis.color,
        fillOpacity: 1,
        weight: 2,
      }).addTo(playLayer);
    }
  }, [scenario, solution, playMin, focusVehicle, excludedVehicles]);

  return (
    <div className="relative h-full min-h-[440px] w-full overflow-hidden bg-snow">
      <div ref={ref} className="h-full min-h-[440px] w-full" />
      {playMin != null && (
        <p className="pointer-events-none absolute right-3 top-3 border border-ink bg-snow px-3 py-1 font-mono text-[12px] font-semibold text-ink">
          LIVE · {String(Math.floor(playMin / 60)).padStart(2, "0")}:{String(playMin % 60).padStart(2, "0")}
        </p>
      )}
    </div>
  );
}
