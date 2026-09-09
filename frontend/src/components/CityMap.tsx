import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ScenarioDetail, Solution } from "../types";
import { VEHICLE_COLORS } from "../types";

interface CityMapProps {
  scenario: ScenarioDetail | null;
  solution: Solution | null;
  selectedId: string | null;
  hoverVehicle: string | null;
  playMin: number | null;
  onSelect: (orderId: string) => void;
}

export function CityMap({ scenario, solution, selectedId, hoverVehicle, playMin, onSelect }: CityMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
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
        const latlngs = route.polyline.map((p) => [p[0], p[1]] as L.LatLngExpression);
        if (latlngs.length > 1) {
          L.polyline(latlngs, {
            color: VEHICLE_COLORS[route.vehicle_id] ?? "#0A0A0A",
            weight: hoverVehicle === route.vehicle_id ? 6 : 4,
            opacity: dim ? 0.18 : 0.92,
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
      else if (meta) color = VEHICLE_COLORS[meta.vid] ?? "#0A0A0A";
      const marker = L.circleMarker([order.lat, order.lon], {
        radius: selectedId === order.order_id ? 11 : played ? 9 : 7,
        color,
        fillColor: selectedId === order.order_id ? "#F47C59" : "#F7F6F2",
        fillOpacity: 1,
        weight: 3,
      });
      marker.bindTooltip(
        [order.order_id, order.customer, order.address, order.priority === "critical" ? "CRITICAL" : "", isDef ? "DEFERRED" : "", meta?.late ? "LATE" : ""]
          .filter(Boolean)
          .join(" · "),
      );
      marker.on("click", () => onSelectRef.current(order.order_id));
      marker.addTo(layer);
    }
    if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [28, 28], maxZoom: 13 });
    }
  }, [scenario, solution, selectedId, hoverVehicle, playMin]);

  return (
    <div className="relative h-full min-h-[480px] overflow-hidden border border-hairline bg-snow">
      <div ref={ref} className="h-full min-h-[480px] w-full" />
      <p className="pointer-events-none absolute left-3 top-3 border border-ink bg-snow px-3 py-1 sys text-ink">
        OSM · OSRM · Bengaluru
      </p>
    </div>
  );
}
