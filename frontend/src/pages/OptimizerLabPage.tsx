import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { LabMap } from "../components/LabMap";
import {
  loadSyntheticScenario,
  runLabOptimize,
  type LabRunResult,
  type LabScenarioPayload,
} from "../lib/labApi";
import { writeLabSession } from "../lib/labSession";
import { patternCss, vehicleVisual } from "../lib/vehicleStyle";
import type { ScenarioDetail, Solution, Stop } from "../types";

type Drawer = "orders" | "vehicles" | "risk" | "tech" | "order" | "legend" | null;
type Phase = "idle" | "loading" | "ready" | "optimizing" | "reoptimizing" | "done" | "error";

function riskBand(p: number): "HIGH" | "MEDIUM" | "LOW" {
  if (p >= 0.55) return "HIGH";
  if (p >= 0.35) return "MEDIUM";
  return "LOW";
}

function toScenarioDetail(s: LabScenarioPayload): ScenarioDetail {
  return {
    id: s.scenario_id,
    code: s.code,
    name: s.name,
    depot: s.depot,
    depot_address: s.depot_address,
    held: [],
    weather: null,
    orders: s.orders.map((o) => ({
      order_id: o.order_id,
      lat: o.lat,
      lon: o.lon,
      demand: o.demand,
      tw_start: o.tw_start,
      tw_end: o.tw_end,
      service_min: o.service_min,
      priority: o.priority,
      zone: o.zone,
      zone_name: o.zone,
      customer: o.customer,
      address: o.address,
      pincode: "",
      phone: "",
      sku: "",
      cod_inr: 0,
    })),
    vehicles: s.vehicles.map((v) => ({
      vehicle_id: v.vehicle_id,
      capacity: v.capacity,
      depot_lat: v.depot_lat,
      depot_lon: v.depot_lon,
      shift_start: v.shift_start,
      shift_end: v.shift_end,
      driver: v.driver,
      plate: v.plate,
      phone: "",
      rating: 0,
      depot_address: s.depot_address,
    })),
  };
}

function persistMetrics(scenario: LabScenarioPayload, result: LabRunResult) {
  writeLabSession({
    summary: scenario.summary,
    metrics: {
      before: {
        distance_km: result.baseline.metrics.distance_km,
        late_count: result.baseline.metrics.late_count,
        hard_breaches: result.baseline.metrics.hard_breaches,
        unassigned_count: result.baseline.metrics.unassigned_count,
      },
      nexus: {
        distance_km: result.optimize.metrics.distance_km,
        late_count: result.optimize.metrics.late_count,
        hard_breaches: result.optimize.metrics.hard_breaches,
        unassigned_count: result.optimize.metrics.unassigned_count,
        feasible: result.feasible,
        partial: result.partial,
      },
      updatedAt: new Date().toLocaleString(),
    },
  });
}

function routeDistanceKm(route: Solution["routes"][number]): number {
  const poly = route.polyline;
  if (poly.length < 2) return 0;
  let km = 0;
  for (let i = 1; i < poly.length; i++) {
    const [aLat, aLon] = poly[i - 1];
    const [bLat, bLon] = poly[i];
    const R = 6371;
    const dLat = ((bLat - aLat) * Math.PI) / 180;
    const dLon = ((bLon - aLon) * Math.PI) / 180;
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    km += 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
  }
  return Math.round(km * 10) / 10;
}

export function OptimizerLabPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = params.get("returnTo") || "/presentation?slide=7";
  const fromSlide = params.get("fromSlide");

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<LabScenarioPayload | null>(null);
  const [result, setResult] = useState<LabRunResult | null>(null);
  const [priorResult, setPriorResult] = useState<LabRunResult | null>(null);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [focusVehicle, setFocusVehicle] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [breakdownVehicle, setBreakdownVehicle] = useState<string>("");
  const [excluded, setExcluded] = useState<string[]>([]);
  const [pendingAffected, setPendingAffected] = useState<string[]>([]);
  const [legendOpen, setLegendOpen] = useState(false);

  const mapScenario = useMemo(() => (scenario ? toScenarioDetail(scenario) : null), [scenario]);
  const activeSolution: Solution | null = result?.optimize ?? null;
  const busy = phase === "loading" || phase === "optimizing" || phase === "reoptimizing";

  const riskStops = useMemo(() => {
    if (!result) return [] as (Stop & { vehicle_id: string })[];
    return result.optimize.routes
      .flatMap((r) => r.stops.map((s) => ({ ...s, vehicle_id: r.vehicle_id })))
      .filter((s) => s.risk)
      .sort((a, b) => (b.risk?.p_late ?? 0) - (a.risk?.p_late ?? 0));
  }, [result]);

  const riskCounts = useMemo(() => {
    let high = 0;
    let medium = 0;
    let low = 0;
    for (const s of riskStops) {
      const b = riskBand(s.risk!.p_late);
      if (b === "HIGH") high++;
      else if (b === "MEDIUM") medium++;
      else low++;
    }
    return { high, medium, low };
  }, [riskStops]);

  const selectedStop = useMemo(() => {
    if (!selectedId || !result) return null;
    for (const r of result.optimize.routes) {
      const s = r.stops.find((x) => x.order_id === selectedId);
      if (s) return { ...s, vehicle_id: r.vehicle_id };
    }
    const u = result.optimize.unassigned.find((x) => x.order_id === selectedId);
    if (u) return { ...u, vehicle_id: "", seq: 0, eta_min: 0, late: false, breach: false, risk: null as Stop["risk"] };
    return null;
  }, [selectedId, result]);

  const vehicleIds = useMemo(() => {
    if (!scenario) return [] as string[];
    return scenario.vehicles.map((v) => v.vehicle_id);
  }, [scenario]);

  async function onLoadScenario() {
    setError(null);
    setResult(null);
    setPriorResult(null);
    setExcluded([]);
    setBreakdownVehicle("");
    setPendingAffected([]);
    setFocusVehicle(null);
    setSelectedId(null);
    setPhase("loading");
    try {
      const payload = await loadSyntheticScenario();
      setScenario(payload);
      writeLabSession({
        returnTo,
        slide: fromSlide ? Number(fromSlide) : 7,
        summary: payload.summary,
      });
      setPhase("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }

  async function onOptimize() {
    if (!scenario) return;
    setError(null);
    setPhase("optimizing");
    try {
      const run = await runLabOptimize({
        scenario_id: scenario.scenario_id,
        orders: scenario.orders,
        vehicles: scenario.vehicles,
        exclude_vehicle_ids: excluded,
        depot_lat: scenario.depot[0],
        depot_lon: scenario.depot[1],
      });
      setResult(run);
      persistMetrics(scenario, run);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }

  function prepareBreakdown() {
    if (!result || !breakdownVehicle) return;
    const affected =
      result.optimize.routes.find((r) => r.vehicle_id === breakdownVehicle)?.stops.map((s) => s.order_id) ?? [];
    setPendingAffected(affected);
  }

  async function onBreakdownReopt() {
    if (!scenario || !breakdownVehicle) return;
    prepareBreakdown();
    setError(null);
    try {
      const nextExcluded = Array.from(new Set([...excluded, breakdownVehicle]));
      const affected =
        result?.optimize.routes.find((r) => r.vehicle_id === breakdownVehicle)?.stops.map((s) => s.order_id) ?? [];
      setPendingAffected(affected);
      setPriorResult(result);
      setPhase("reoptimizing");
      const run = await runLabOptimize({
        scenario_id: scenario.scenario_id,
        orders: scenario.orders,
        vehicles: scenario.vehicles,
        exclude_vehicle_ids: nextExcluded,
        depot_lat: scenario.depot[0],
        depot_lon: scenario.depot[1],
      });
      setExcluded(nextExcluded);
      setResult(run);
      persistMetrics(scenario, run);
      setPhase("done");
      setBreakdownVehicle("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }

  function backToPresentation() {
    writeLabSession({ returnTo, slide: fromSlide ? Number(fromSlide) : undefined });
    navigate(returnTo);
  }

  function selectOrder(id: string) {
    setSelectedId(id);
    setDrawer("order");
  }

  const before = result?.baseline.metrics;
  const nexus = result?.optimize.metrics;
  const statusLabel =
    phase === "loading"
      ? "Generating scenario…"
      : phase === "optimizing"
        ? "Optimizing routes…"
        : phase === "reoptimizing"
          ? "Recalculating routes…"
          : phase === "done" && result
            ? result.partial || !result.feasible
              ? "Partial plan"
              : "Optimization complete"
            : null;

  return (
    <div className="min-h-[calc(100dvh-65px)] bg-paper text-ink">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-hairline pb-5">
          <div>
            <button
              type="button"
              onClick={backToPresentation}
              className="font-sans text-[12px] font-semibold text-mute hover:text-ink"
            >
              ← Back to Presentation
            </button>
            <h1 className="mt-2 font-sans text-[28px] font-semibold tracking-tight md:text-[32px]">
              Nexus Optimizer Lab
            </h1>
            <p className="mt-1 font-sans text-[14px] text-mute">Last-Mile Delivery Optimization</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onLoadScenario()}
              className="bg-coral px-4 py-2.5 font-sans text-[13px] font-semibold text-ink disabled:opacity-40"
            >
              {phase === "loading" ? "Generating…" : scenario ? "New Scenario" : "Load Synthetic Scenario"}
            </button>
            <button
              type="button"
              onClick={() => setDrawer("tech")}
              className="border border-hairline bg-snow px-3 py-2.5 font-sans text-[13px] font-semibold text-mute hover:text-ink"
            >
              Technical Details
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-coral bg-[#FFF5F2] px-4 py-3 font-sans text-[14px]">
            <p>{error}</p>
            <button
              type="button"
              className="border border-ink px-3 py-1.5 text-[12px] font-semibold"
              onClick={() => void (scenario ? onOptimize() : onLoadScenario())}
            >
              {scenario ? "Try Again" : "Retry"}
            </button>
          </div>
        )}

        {/* Scenario strip */}
        {scenario && (
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border border-hairline bg-snow px-4 py-3 font-sans text-[13px]">
            <span className="tabular">
              <strong className="text-[16px]">{scenario.summary.orders}</strong>
              <span className="ml-1.5 text-mute">ORDERS</span>
            </span>
            <span className="tabular">
              <strong className="text-[16px]">{scenario.summary.vehicles}</strong>
              <span className="ml-1.5 text-mute">VEHICLES</span>
            </span>
            <span className="tabular">
              <strong className="text-[16px]">{scenario.summary.critical}</strong>
              <span className="ml-1.5 text-mute">CRITICAL</span>
            </span>
            <span className="tabular">
              <strong className="text-[16px]">{scenario.summary.total_demand}</strong>
              <span className="ml-1.5 text-mute">DEMAND</span>
            </span>
            <span className="ml-auto flex gap-2">
              <button type="button" className="text-[12px] font-semibold text-mute hover:text-ink" onClick={() => setDrawer("orders")}>
                View orders
              </button>
              <button type="button" className="text-[12px] font-semibold text-mute hover:text-ink" onClick={() => setDrawer("vehicles")}>
                View vehicles
              </button>
            </span>
          </div>
        )}

        {/* Optimize CTA + comparison */}
        {scenario && (
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              {statusLabel && (
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-coral">{statusLabel}</p>
              )}
              {!result && phase !== "optimizing" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onOptimize()}
                  className="mt-2 bg-ink px-5 py-3 font-sans text-[14px] font-semibold text-snow disabled:opacity-40"
                >
                  Optimize Routes
                </button>
              )}
              {(phase === "optimizing" || phase === "reoptimizing") && (
                <p className="mt-2 font-sans text-[14px] text-mute">Calling OR-Tools CVRPTW + late-risk model…</p>
              )}
            </div>
            {result && before && nexus && (
              <div className="min-w-[280px] flex-1 overflow-x-auto border border-hairline bg-snow px-4 py-3">
                <table className="w-full text-left font-sans text-[13px]">
                  <thead>
                    <tr className="text-mute">
                      <th className="pb-2 font-medium"> </th>
                      <th className="pb-2 font-medium">Baseline</th>
                      <th className="pb-2 font-medium text-coral">Nexus</th>
                    </tr>
                  </thead>
                  <tbody className="tabular">
                    <tr className="border-t border-hairline">
                      <td className="py-1.5 text-mute">Distance</td>
                      <td className="py-1.5">{before.distance_km} km</td>
                      <td className="py-1.5 font-semibold">{nexus.distance_km} km</td>
                    </tr>
                    <tr className="border-t border-hairline">
                      <td className="py-1.5 text-mute">Late</td>
                      <td className="py-1.5">{before.late_count}</td>
                      <td className="py-1.5 font-semibold">{nexus.late_count}</td>
                    </tr>
                    <tr className="border-t border-hairline">
                      <td className="py-1.5 text-mute">Breaches</td>
                      <td className="py-1.5">{before.hard_breaches}</td>
                      <td className="py-1.5 font-semibold">{nexus.hard_breaches}</td>
                    </tr>
                  </tbody>
                </table>
                {result.partial && (
                  <p className="mt-2 font-sans text-[12px] text-coral">
                    Partial plan — some deliveries could not be assigned under hard constraints.
                  </p>
                )}
                {!result.feasible && (
                  <p className="mt-2 font-sans text-[12px] text-coral">
                    Infeasible under hard constraints. Deferred orders are listed with the routes.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Map centerpiece */}
        {scenario && (
          <section className="mt-6">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">Route map</p>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setFocusVehicle(null)}
                  className={`px-2.5 py-1 font-sans text-[12px] font-semibold ${
                    !focusVehicle ? "bg-ink text-snow" : "border border-hairline bg-snow text-mute"
                  }`}
                >
                  All
                </button>
                {vehicleIds.map((vid) => {
                  const vis = vehicleVisual(vid);
                  const down = excluded.includes(vid);
                  return (
                    <button
                      key={vid}
                      type="button"
                      disabled={down}
                      onClick={() => setFocusVehicle(vid)}
                      className={`px-2.5 py-1 font-sans text-[12px] font-semibold disabled:opacity-40 ${
                        focusVehicle === vid ? "text-snow" : "border border-hairline bg-snow"
                      }`}
                      style={
                        focusVehicle === vid
                          ? { background: vis.color, color: "#fff" }
                          : { color: vis.color, borderColor: vis.color }
                      }
                    >
                      {down ? `⚠ ${vid}` : vid}
                    </button>
                  );
                })}
              </div>
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => setLegendOpen((v) => !v)}
                  className="border border-hairline bg-snow px-2.5 py-1 font-sans text-[12px] font-semibold text-mute hover:text-ink"
                >
                  {legendOpen ? "Hide legend" : "Map legend"}
                </button>
                {result && (
                  <button
                    type="button"
                    onClick={() => setDrawer("risk")}
                    className="border border-hairline bg-snow px-2.5 py-1 font-sans text-[12px] font-semibold text-mute hover:text-ink"
                  >
                    Delivery risk · {riskCounts.high} high
                  </button>
                )}
              </div>
            </div>

            <div className="relative border border-hairline bg-snow shadow-card">
              <div className="h-[min(58vh,560px)] min-h-[420px]">
                <LabMap
                  scenario={mapScenario}
                  solution={activeSolution}
                  selectedId={selectedId}
                  focusVehicle={focusVehicle}
                  excludedVehicles={excluded}
                  disruptedOrderIds={pendingAffected}
                  onSelect={selectOrder}
                />
              </div>
              {legendOpen && (
                <div className="absolute bottom-3 left-3 z-[500] max-w-xs border border-hairline bg-snow/95 p-3 shadow-panel backdrop-blur-sm">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-mute">Map legend</p>
                  <ul className="mt-2 space-y-1.5 font-sans text-[12px] text-ink">
                    <li className="flex items-center gap-2">
                      <span className="inline-block h-3 w-3 rounded-full border-2 border-ink bg-ice" /> Depot
                    </li>
                    {vehicleIds.map((vid) => {
                      const vis = vehicleVisual(vid);
                      return (
                        <li key={vid} className="flex items-center gap-2">
                          <span
                            className="inline-block w-8 border-t-2"
                            style={{
                              borderColor: vis.color,
                              borderStyle: patternCss(vis.patternLabel),
                            }}
                          />
                          {vid}
                          {excluded.includes(vid) ? " · unavailable" : ""}
                          <span className="text-mute">({vis.patternLabel})</span>
                        </li>
                      );
                    })}
                    <li className="flex items-center gap-2 pt-1">
                      <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-ink bg-paper" /> ○ Normal
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="inline-block h-2.5 w-2.5 rotate-45 border-2 border-ink bg-[#FFF0E8]" /> ◆ Critical
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="font-bold text-coral">!</span> High risk
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="font-bold text-coral">⚠</span> Vehicle unavailable
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="font-bold text-coral">×</span> Deferred / failed assign
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Compact route cards */}
        {result && (
          <section className="mt-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-mute">Routes</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {result.optimize.routes
                .filter((r) => !excluded.includes(r.vehicle_id) && r.stops.length > 0)
                .map((route) => {
                  const vis = vehicleVisual(route.vehicle_id);
                  const active = focusVehicle === route.vehicle_id;
                  return (
                    <button
                      key={route.vehicle_id}
                      type="button"
                      onClick={() => setFocusVehicle((v) => (v === route.vehicle_id ? null : route.vehicle_id))}
                      className={`border bg-snow px-3 py-3 text-left transition ${
                        active ? "border-ink shadow-card" : "border-hairline hover:border-ink/40"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-6 border-t-[3px]"
                          style={{ borderColor: vis.color, borderStyle: patternCss(vis.patternLabel) }}
                        />
                        <span className="font-sans text-[14px] font-semibold">{route.vehicle_id}</span>
                      </div>
                      <p className="mt-1 font-sans text-[12px] text-mute tabular">
                        {route.stops.length} stops · {routeDistanceKm(route)} km · {route.load} kg
                      </p>
                    </button>
                  );
                })}
            </div>
            {excluded.map((vid) => (
              <div key={vid} className="mt-2 border border-coral bg-[#FFF5F2] px-3 py-2 font-sans text-[13px]">
                ⚠ {vid} unavailable
              </div>
            ))}
            {result.optimize.unassigned.length > 0 && (
              <p className="mt-3 font-sans text-[13px] text-coral">
                Deferred: {result.optimize.unassigned.map((u) => u.order_id).join(", ")}
              </p>
            )}
          </section>
        )}

        {/* Risk summary strip */}
        {result && riskStops.length > 0 && (
          <section className="mt-5 flex flex-wrap items-center gap-4 border border-hairline bg-snow px-4 py-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-mute">Delivery risk</p>
              <p className="mt-1 font-sans text-[13px]">
                High <strong className="text-coral">{riskCounts.high}</strong>
                <span className="mx-2 text-hairline">·</span>
                Medium <strong>{riskCounts.medium}</strong>
                <span className="mx-2 text-hairline">·</span>
                Low <strong>{riskCounts.low}</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDrawer("risk")}
              className="border border-hairline px-3 py-1.5 font-sans text-[12px] font-semibold"
            >
              View high-risk deliveries
            </button>
          </section>
        )}

        {/* Breakdown */}
        {result && (
          <section className="mt-6 border border-hairline bg-snow p-4">
            {excluded.length > 0 && priorResult ? (
              <div className="mb-4 border border-coral bg-[#FFF5F2] px-3 py-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-coral">Vehicle disruption</p>
                <p className="mt-1 font-sans text-[15px] font-semibold">
                  Vehicle {excluded.join(", ")} unavailable
                </p>
                {pendingAffected.length > 0 && (
                  <p className="mt-1 font-sans text-[13px] text-mute">
                    Affected: {pendingAffected.join(", ")}
                  </p>
                )}
                <ol className="mt-3 grid gap-2 font-sans text-[12px] text-mute sm:grid-cols-4">
                  <li>
                    <span className="font-semibold text-ink">Original</span>
                    <br />
                    {priorResult.optimize.metrics.distance_km} km · {priorResult.optimize.metrics.late_count} late
                  </li>
                  <li>
                    <span className="font-semibold text-ink">Disruption</span>
                    <br />
                    {excluded.join(", ")} down
                  </li>
                  <li>
                    <span className="font-semibold text-ink">Reoptimize</span>
                    <br />
                    Real OR-Tools run
                  </li>
                  <li>
                    <span className="font-semibold text-ink">New plan</span>
                    <br />
                    {result.optimize.metrics.distance_km} km · {result.optimize.metrics.late_count} late
                  </li>
                </ol>
              </div>
            ) : null}

            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-mute">Simulate vehicle breakdown</p>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <label className="block font-sans text-[13px] text-mute">
                Active vehicle
                <select
                  className="mt-1 block min-w-[180px] border border-hairline bg-paper px-3 py-2 text-ink"
                  value={breakdownVehicle}
                  onChange={(e) => {
                    setBreakdownVehicle(e.target.value);
                  }}
                >
                  <option value="">Select…</option>
                  {scenario?.vehicles
                    .filter((v) => !excluded.includes(v.vehicle_id))
                    .filter((v) => (result.optimize.routes.find((r) => r.vehicle_id === v.vehicle_id)?.stops.length ?? 0) > 0)
                    .map((v) => (
                      <option key={v.vehicle_id} value={v.vehicle_id}>
                        {v.vehicle_id} · {v.plate}
                      </option>
                    ))}
                </select>
              </label>
              <button
                type="button"
                disabled={!breakdownVehicle || busy}
                onClick={() => void onBreakdownReopt()}
                className="bg-coral px-4 py-2.5 font-sans text-[13px] font-semibold disabled:opacity-40"
              >
                {phase === "reoptimizing" ? "Recalculating…" : "Reoptimize"}
              </button>
            </div>
            {breakdownVehicle && (
              <p className="mt-2 font-sans text-[13px] text-mute">
                Will mark {breakdownVehicle} unavailable. Affected now:{" "}
                {(
                  result.optimize.routes.find((r) => r.vehicle_id === breakdownVehicle)?.stops.map((s) => s.order_id) ??
                  []
                ).join(", ") || "none"}
              </p>
            )}
          </section>
        )}

        {!scenario && phase === "idle" && (
          <p className="mt-16 max-w-md font-sans text-[15px] text-mute">
            Load a synthetic Bengaluru scenario, then optimize with the real CVRPTW engine. Each load creates a new
            day.
          </p>
        )}
      </div>

      {/* Drawers */}
      {drawer && (
        <div className="fixed inset-0 z-40 flex justify-end bg-ink/30" role="dialog" onClick={() => setDrawer(null)}>
          <div
            className="h-full w-full max-w-md overflow-auto border-l border-hairline bg-snow p-5 shadow-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-sans text-[16px] font-semibold">
                {drawer === "orders" && "Orders"}
                {drawer === "vehicles" && "Vehicles"}
                {drawer === "risk" && "High-risk deliveries"}
                {drawer === "tech" && "Technical Details"}
                {drawer === "order" && "Order details"}
                {drawer === "legend" && "Map legend"}
              </h3>
              <button type="button" className="text-mute" onClick={() => setDrawer(null)}>
                Close
              </button>
            </div>

            {drawer === "orders" && scenario && (
              <ul className="mt-4 space-y-2 font-sans text-[13px]">
                {scenario.orders.map((o) => (
                  <li key={o.order_id} className="border-b border-hairline py-2">
                    <button type="button" className="text-left font-semibold hover:text-coral" onClick={() => selectOrder(o.order_id)}>
                      {o.priority === "critical" ? "◆ " : "○ "}
                      {o.order_id}
                    </button>
                    <br />
                    <span className="text-mute">
                      {o.customer} · {o.demand} demand
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {drawer === "vehicles" && scenario && (
              <ul className="mt-4 space-y-2 font-sans text-[13px]">
                {scenario.vehicles.map((v) => {
                  const vis = vehicleVisual(v.vehicle_id);
                  return (
                    <li key={v.vehicle_id} className="border-b border-hairline py-2">
                      <span className="font-semibold" style={{ color: vis.color }}>
                        {v.vehicle_id}
                      </span>{" "}
                      · {v.driver}
                      <br />
                      <span className="text-mute">
                        cap {v.capacity} · {vis.patternLabel}
                        {excluded.includes(v.vehicle_id) ? " · BREAKDOWN" : ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            {drawer === "risk" && (
              <div className="mt-4 space-y-2 font-sans text-[13px]">
                <p className="text-mute">Predicted late-delivery risk from the current optimize run.</p>
                {riskStops
                  .filter((s) => riskBand(s.risk!.p_late) === "HIGH")
                  .map((s) => (
                    <button
                      key={s.order_id}
                      type="button"
                      onClick={() => selectOrder(s.order_id)}
                      className="flex w-full items-center justify-between border border-hairline px-3 py-2 text-left hover:border-coral"
                    >
                      <span className="font-semibold">{s.order_id}</span>
                      <span className="tabular text-coral">
                        HIGH {(s.risk!.p_late * 100).toFixed(0)}%
                      </span>
                    </button>
                  ))}
                {!riskCounts.high && <p className="text-mute">No high-risk stops in this run.</p>}
              </div>
            )}

            {drawer === "order" && selectedStop && (
              <div className="mt-4 space-y-3 font-sans text-[14px]">
                <p className="text-[20px] font-semibold">
                  {selectedStop.priority === "critical" ? "◆ " : ""}
                  {selectedStop.order_id}
                </p>
                <dl className="space-y-2 text-[13px]">
                  <div>
                    <dt className="text-mute">Customer</dt>
                    <dd>{selectedStop.customer || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-mute">Priority</dt>
                    <dd className="capitalize">{selectedStop.priority}</dd>
                  </div>
                  <div>
                    <dt className="text-mute">Vehicle</dt>
                    <dd>{selectedStop.vehicle_id || "Unassigned / deferred"}</dd>
                  </div>
                  {"eta_min" in selectedStop && selectedStop.vehicle_id && (
                    <div>
                      <dt className="text-mute">ETA (min from shift)</dt>
                      <dd className="tabular">{selectedStop.eta_min}</dd>
                    </div>
                  )}
                  {selectedStop.risk && (
                    <div>
                      <dt className="text-mute">Predicted late-delivery risk</dt>
                      <dd className="font-semibold text-coral">
                        {riskBand(selectedStop.risk.p_late)} — {(selectedStop.risk.p_late * 100).toFixed(0)}%
                      </dd>
                      <p className="mt-2 text-[12px] text-mute">Why?</p>
                      <ul className="mt-1 list-disc pl-4 text-[12px] text-mute">
                        {(selectedStop.risk.reasons ?? []).map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                        {!(selectedStop.risk.reasons ?? []).length && <li>No reason strings returned for this stop.</li>}
                      </ul>
                      <p className="mt-3 font-mono text-[10px] text-mute">Model: GradientBoostingClassifier</p>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {drawer === "tech" && (
              <dl className="mt-4 space-y-3 font-sans text-[13px]">
                <div>
                  <dt className="text-mute">Algorithm</dt>
                  <dd>CVRPTW · Google OR-Tools</dd>
                </div>
                <div>
                  <dt className="text-mute">ML</dt>
                  <dd>GradientBoostingClassifier</dd>
                </div>
                <div>
                  <dt className="text-mute">Pipeline</dt>
                  <dd>POST /api/lab/synthetic → POST /api/lab/run</dd>
                </div>
                <div>
                  <dt className="text-mute">Frontend</dt>
                  <dd>React · Vite · Leaflet</dd>
                </div>
                <Link to="/lab" className="inline-block text-coral">
                  Legacy Lab (/lab)
                </Link>
              </dl>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
