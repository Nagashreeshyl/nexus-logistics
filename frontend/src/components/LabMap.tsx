import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ScenarioDetail, Solution } from "../types";
import { vehicleVisual } from "../lib/vehicleStyle";

export interface LabMapProps {
  scenario: ScenarioDetail | null;
  solution: Solution | null;
  selectedId: string | null;
  focusVehicle: string | null;
  excludedVehicles?: string[];
  disruptedOrderIds?: string[];
  onSelect: (orderId: string) => void;
}

function riskHigh(p: number | undefined): boolean {
  return (p ?? 0) >= 0.55;
}

/**
 * Light-theme Lab map: distinct vehicle routes (color + dash), shaped stops, breakdown state.
 */
export function LabMap({
  scenario,
  solution,
  selectedId,
  focusVehicle,
  excludedVehicles = [],
  disruptedOrderIds = [],
  onSelect,
}: LabMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
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
    mapRef.current = map;
    const t = window.setTimeout(() => map.invalidateSize(), 180);
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
    const excluded = new Set(excludedVehicles);
    const disrupted = new Set(disruptedOrderIds);

    // Routes (active vehicles only; excluded drawn muted if prior polyline available via empty)
    if (solution) {
      for (const route of solution.routes) {
        if (excluded.has(route.vehicle_id)) continue;
        if (!route.stops.length && route.polyline.length < 2) continue;
        const vis = vehicleVisual(route.vehicle_id);
        const dim = Boolean(focusVehicle && focusVehicle !== route.vehicle_id);
        const latlngs = route.polyline.map((p) => [p[0], p[1]] as L.LatLngExpression);
        if (latlngs.length > 1) {
          L.polyline(latlngs, {
            color: vis.color,
            weight: focusVehicle === route.vehicle_id ? 6 : 4,
            opacity: dim ? 0.18 : 0.95,
            dashArray: vis.dashArray ? vis.dashArray.join(" ") : undefined,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(layer);
        }
        // Mid-route vehicle badge
        if (latlngs.length >= 2 && (!focusVehicle || focusVehicle === route.vehicle_id)) {
          const mid = latlngs[Math.floor(latlngs.length / 2)] as [number, number];
          const icon = L.divIcon({
            className: "",
            html: `<div style="
              display:flex;align-items:center;gap:4px;
              background:#fff;border:2px solid ${vis.color};border-radius:4px;
              padding:2px 6px;font:600 11px Outfit,sans-serif;color:#0A0A0A;
              box-shadow:0 1px 4px rgba(0,0,0,.12);white-space:nowrap;
            "><span style="width:8px;height:8px;background:${vis.color};border-radius:1px;display:inline-block"></span>${route.vehicle_id}</div>`,
            iconSize: [64, 22],
            iconAnchor: [32, 11],
          });
          L.marker(mid, { icon, interactive: false, opacity: dim ? 0.25 : 1 }).addTo(layer);
        }
      }
    }

    // Breakdown markers near depot offset for excluded vehicles
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
        iconSize: [140, 26],
        iconAnchor: [70, 13],
      });
      L.marker([lat, lon], { icon, interactive: false }).addTo(layer);
      // muted ghost ring in vehicle color
      L.circleMarker([lat, lon], {
        radius: 8,
        color: vis.color,
        fillColor: "#F47C59",
        fillOpacity: 0.35,
        weight: 2,
        dashArray: "4 3",
      }).addTo(layer);
    });

    // Depot
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

      let fill = "#F7F6F2";
      let stroke = "#0A0A0A";
      if (meta) stroke = vehicleVisual(meta.vid).color;
      if (isDef) {
        stroke = "#F47C59";
        fill = "#F47C59";
      } else if (isHigh) {
        fill = "#FFE8E0";
      } else if (isCrit) {
        fill = "#FFF0E8";
      }

      const selected = selectedId === order.order_id;
      const radius = selected ? 12 : isCrit || isHigh ? 9 : 7;

      if (isCrit && !isDef) {
        // diamond via rotated square divIcon for critical
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
          [
            "◆ " + order.order_id,
            order.customer,
            "CRITICAL",
            isHigh ? `HIGH RISK ${Math.round((meta?.pLate ?? 0) * 100)}%` : "",
            meta ? meta.vid : "",
            isDisrupt ? "DISRUPTED" : "",
          ]
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
        const prefix = isDef ? "× " : isHigh ? "! " : "○ ";
        marker.bindTooltip(
          [
            prefix + order.order_id,
            order.customer,
            isCrit ? "CRITICAL" : "",
            isHigh ? `HIGH RISK ${Math.round((meta?.pLate ?? 0) * 100)}%` : "",
            meta ? meta.vid : "",
            isDef ? "DEFERRED" : "",
            isDisrupt ? "DISRUPTED" : "",
          ]
            .filter(Boolean)
            .join(" · "),
        );
        marker.on("click", () => onSelectRef.current(order.order_id));
        marker.addTo(layer);
      }

      // high-risk bang badge
      if (isHigh && !isDef) {
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

    if (bounds.length > 1) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [36, 36], maxZoom: 13 });
    }
    window.setTimeout(() => map.invalidateSize(), 80);
  }, [scenario, solution, selectedId, focusVehicle, excludedVehicles, disruptedOrderIds]);

  return (
    <div className="relative h-full min-h-[440px] w-full overflow-hidden bg-snow">
      <div ref={ref} className="h-full min-h-[440px] w-full" />
    </div>
  );
}
