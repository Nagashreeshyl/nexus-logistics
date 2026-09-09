import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { OpsDelivery } from "../../lib/opsTypes";

/** Lightweight driver route map — synthetic locations labeled. */
export function DriverRouteMap({
  deliveries,
  driverLocation,
}: {
  deliveries: OpsDelivery[];
  driverLocation?: { lat: number; lon: number; synthetic?: boolean } | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

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
    if (!map || !layer) return;
    layer.clearLayers();
    const bounds: L.LatLngExpression[] = [];

    L.circleMarker([12.9716, 77.5946], {
      radius: 9,
      color: "#0A0A0A",
      fillColor: "#92CFF2",
      fillOpacity: 1,
      weight: 2,
    })
      .bindTooltip("Depot")
      .addTo(layer);
    bounds.push([12.9716, 77.5946]);

    if (driverLocation) {
      L.circleMarker([driverLocation.lat, driverLocation.lon], {
        radius: 10,
        color: "#0A0A0A",
        fillColor: "#F47C59",
        fillOpacity: 1,
        weight: 2,
      })
        .bindTooltip(driverLocation.synthetic ? "Driver (synthetic location)" : "Driver")
        .addTo(layer);
      bounds.push([driverLocation.lat, driverLocation.lon]);
    }

    const sorted = [...deliveries].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
    const line: L.LatLngExpression[] = [[12.9716, 77.5946]];
    sorted.forEach((d, idx) => {
      const lat = d.lastLocation?.lat ?? 12.97 + idx * 0.01;
      const lon = d.lastLocation?.lon ?? 77.59 + idx * 0.008;
      const done = d.status === "DELIVERED";
      L.circleMarker([lat, lon], {
        radius: 8,
        color: "#0A0A0A",
        fillColor: done ? "#0A0A0A" : "#F47C59",
        fillOpacity: done ? 0.35 : 1,
        weight: 2,
      })
        .bindTooltip(`${idx + 1}. ${d.orderId} · ${d.status}${d.lastLocation?.synthetic ? " · synthetic" : ""}`)
        .addTo(layer);
      line.push([lat, lon]);
      bounds.push([lat, lon]);
    });
    if (line.length > 1) {
      L.polyline(line, { color: "#0A0A0A", weight: 3, opacity: 0.7 }).addTo(layer);
    }
    if (bounds.length) map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [28, 28] });
  }, [deliveries, driverLocation]);

  return (
    <div className="mt-4">
      <div ref={ref} className="h-[320px] w-full border border-hairline" />
      <p className="mt-1 font-mono text-[11px] text-mute">Map positions may be synthetic/demo — not live GPS telemetry.</p>
    </div>
  );
}
