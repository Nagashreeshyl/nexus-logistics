import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RoutePlan, ScenarioDetail, Solution } from "../types";
import { vehicleColor, vehicleVisual } from "../lib/vehicleStyle";

interface CityMapProps {
  scenario: ScenarioDetail | null;
  solution: Solution | null;
  selectedId: string | null;
  hoverVehicle: string | null;
  playMin: number | null;
  onSelect: (orderId: string) => void;
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

export function CityMap({ scenario, solution, selectedId, hoverVehicle, playMin, onSelect }: CityMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const playLayerRef = useRef<L.LayerGroup | null>(null);
  const fittedKey = useRef("");
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

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
        const dim = Boolean(hoverVehicle && hoverVehicle !== route.vehicle_id);
        const vis = vehicleVisual(route.vehicle_id);
        const latlngs = route.polyline.map((p) => [p[0], p[1]] as L.LatLngExpression);
        if (latlngs.length > 1) {
          L.polyline(latlngs, {
            color: vis.color,
            weight: hoverVehicle === route.vehicle_id ? 6 : 4,
            opacity: dim ? 0.18 : 0.92,
            dashArray: vis.dashArray ? vis.dashArray.join(" ") : undefined,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(layer);
        }
      }
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

    const assigned = new Map<string, { vid: string; late: boolean; breach: boolean; eta: number }>();
    if (solution) {
      for (const r of solution.routes) {
        for (const s of r.stops) {
          assigned.set(s.order_id, { vid: r.vehicle_id, late: s.late, breach: s.breach, eta: s.eta_min });
        }
      }
    }
    const deferred = new Set(solution?.unassigned.map((u) => u.order_id) ?? []);

    for (const order of scenario.orders) {
      bounds.push([order.lat, order.lon]);
      const meta = assigned.get(order.order_id);
      const isDef = deferred.has(order.order_id);
      const played = playMin != null && meta != null && meta.eta <= playMin;
      let color = "#0A0A0A";
      if (isDef) color = "#F47C59";
      else if (meta?.late || meta?.breach) color = "#F47C59";
      else if (meta) color = vehicleColor(meta.vid);
      const fill = selectedId === order.order_id ? "#F47C59" : played && meta ? vehicleColor(meta.vid) : "#F7F6F2";
      const marker = L.circleMarker([order.lat, order.lon], {
        radius: selectedId === order.order_id ? 11 : played ? 9 : 7,
        color,
        fillColor: fill,
        fillOpacity: 1,
        weight: 3,
      });
      marker.bindTooltip(
        [
          order.order_id,
          order.customer,
          order.address,
          order.priority === "critical" ? "CRITICAL" : "",
          isDef ? "DEFERRED" : "",
          meta?.late ? "LATE" : "",
          played ? "SERVED" : "",
        ]
          .filter(Boolean)
          .join(" · "),
      );
      marker.on("click", () => onSelectRef.current(order.order_id));
      marker.addTo(layer);
    }

    const fitKey = `${scenario.id}:${solution?.mode ?? "none"}:${solution?.routes.length ?? 0}`;
    if (bounds.length > 1 && fittedKey.current !== fitKey) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [28, 28], maxZoom: 13 });
      fittedKey.current = fitKey;
    }
  }, [scenario, solution, selectedId, hoverVehicle, playMin]);

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
      if (hoverVehicle && hoverVehicle !== route.vehicle_id) continue;
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
  }, [scenario, solution, playMin, hoverVehicle]);

  return (
    <div className="relative h-full min-h-[480px] overflow-hidden border border-hairline bg-snow">
      <div ref={ref} className="h-full min-h-[480px] w-full" />
      <p className="pointer-events-none absolute right-3 top-3 border border-ink bg-snow px-3 py-1 font-mono text-[10px] uppercase tracking-wide text-ink">
        OSM · Bengaluru
      </p>
      {playMin != null && (
        <p className="pointer-events-none absolute bottom-3 left-3 border border-ink bg-snow px-3 py-1 font-mono text-[12px] font-semibold">
          Play · {String(Math.floor(playMin / 60)).padStart(2, "0")}:{String(playMin % 60).padStart(2, "0")}
        </p>
      )}
    </div>
  );
}
