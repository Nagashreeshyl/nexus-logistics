/**
 * Nexus Optimizer Lab — focused hackathon workbench.
 * Pipeline: Load synthetic → Optimize (/api/lab/run) → Map + risk → Breakdown → Reoptimize.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Loader2, Map as MapIcon, Sparkles, X } from "lucide-react";
import { LabMap } from "../components/LabMap";
import { BrandLogo } from "../components/BrandLogo";
import {
  loadSyntheticScenario,
  runLabOptimize,
  type LabRunResult,
  type LabScenarioPayload,
} from "../lib/labApi";
import { writeLabSession } from "../lib/labSession";
import { patternCss, vehicleVisual } from "../lib/vehicleStyle";
import type { ScenarioDetail, Solution, Stop } from "../types";

function labToScenario(s: LabScenarioPayload): ScenarioDetail {
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

function routeDistanceKm(route: Solution["routes"][0]): number {
  const poly = route.polyline;
  if (poly.length < 2) return 0;
  let m = 0;
  for (let i = 1; i < poly.length; i++) {
    const [lat1, lon1] = poly[i - 1];
    const [lat2, lon2] = poly[i];
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    m += 2 * R * Math.asin(Math.sqrt(a));
  }
  return Math.round(m * 10) / 10;
}

type Busy = "synthetic" | "optimize" | "reoptimize" | null;
type Drawer = "orders" | "vehicles" | "risk" | null;

interface OptimizerLabWorkbenchProps {
  returnTo: string;
  fromSlide?: number;
  onBack: () => void;
}

export function OptimizerLabWorkbench({ returnTo, fromSlide, onBack }: OptimizerLabWorkbenchProps) {
  const [payload, setPayload] = useState<LabScenarioPayload | null>(null);
  const [scenario, setScenario] = useState<ScenarioDetail | null>(null);
  const [baseline, setBaseline] = useState<Solution | null>(null);
  const [solution, setSolution] = useState<Solution | null>(null);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [focusVehicle, setFocusVehicle] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [legendOpen, setLegendOpen] = useState(true);
  const [breakdownPick, setBreakdownPick] = useState(false);
  const [playMin, setPlayMin] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [preBreakdown, setPreBreakdown] = useState<Solution | null>(null);

  const disruptedOrderIds = useMemo(() => {
    if (!preBreakdown || !excluded.length) return [] as string[];
    const ids: string[] = [];
    for (const r of preBreakdown.routes) {
      if (excluded.includes(r.vehicle_id)) {
        for (const s of r.stops) ids.push(s.order_id);
      }
    }
    return ids;
  }, [preBreakdown, excluded]);

  const persistSession = useCallback(
    (summary: LabScenarioPayload["summary"] & { generation_id?: string }, result: LabRunResult) => {
      writeLabSession({
        returnTo,
        slide: fromSlide,
        summary: {
          orders: summary.orders,
          vehicles: summary.vehicles,
          critical: summary.critical,
          total_demand: summary.total_demand,
          generation_id: summary.generation_id,
        },
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
            feasible: result.optimize.feasible,
            partial: result.optimize.partial,
          },
          updatedAt: new Date().toISOString(),
        },
      });
    },
    [returnTo, fromSlide],
  );

  const loadSynthetic = useCallback(async () => {
    setBusy("synthetic");
    setError(null);
    setSolution(null);
    setBaseline(null);
    setExcluded([]);
    setPreBreakdown(null);
    setSelectedId(null);
    setFocusVehicle(null);
    setPlayMin(null);
    setPlaying(false);
    setBreakdownPick(false);
    try {
      const next = await loadSyntheticScenario();
      setPayload(next);
      setScenario(labToScenario(next));
      writeLabSession({
        returnTo,
        slide: fromSlide,
        summary: {
          ...next.summary,
          generation_id: next.generation_id,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to generate scenario.");
    } finally {
      setBusy(null);
    }
  }, [returnTo, fromSlide]);

  const optimize = useCallback(
    async (excludeIds: string[] = [], mode: Busy = "optimize") => {
      if (!payload) {
        setError("Load a synthetic scenario first.");
        return;
      }
      setBusy(mode);
      setError(null);
      setPlaying(false);
      setPlayMin(null);
      try {
        const result = await runLabOptimize({
          scenario_id: payload.scenario_id,
          orders: payload.orders,
          vehicles: payload.vehicles,
          exclude_vehicle_ids: excludeIds,
          depot_lat: payload.depot[0],
          depot_lon: payload.depot[1],
        });
        setBaseline(result.baseline);
        setSolution(result.optimize);
        setExcluded(result.excluded_vehicles ?? excludeIds);
        persistSession(
          {
            ...payload.summary,
            generation_id: payload.generation_id,
          },
          result,
        );
        if (mode === "reoptimize" && preBreakdown) {
          const affected = preBreakdown.routes
            .filter((r) => excludeIds.includes(r.vehicle_id))
            .reduce((n, r) => n + r.stops.length, 0);
          writeLabSession({
            disruption: {
              vehicle_id: excludeIds[0] ?? "—",
              affected_orders: affected,
              before_late: preBreakdown.metrics.late_count,
              after_late: result.optimize.metrics.late_count,
              before_distance_km: preBreakdown.metrics.distance_km,
              after_distance_km: result.optimize.metrics.distance_km,
              updatedAt: new Date().toISOString(),
            },
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Optimization could not be completed.");
      } finally {
        setBusy(null);
      }
    },
    [payload, persistSession, preBreakdown],
  );

  const startBreakdown = useCallback((vehicleId: string) => {
    if (!solution) return;
    setPreBreakdown(solution);
    setExcluded([vehicleId]);
    setBreakdownPick(false);
    setFocusVehicle(null);
  }, [solution]);

  const reoptimize = useCallback(() => {
    if (!excluded.length) return;
    void optimize(excluded, "reoptimize");
  }, [excluded, optimize]);

  const playRaf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(playRaf.current), []);

  const startPlay = useCallback(() => {
    if (!solution) return;
    cancelAnimationFrame(playRaf.current);
    const maxEta = Math.max(0, ...solution.routes.flatMap((r) => r.stops.map((s) => s.eta_min)), 1);
    setPlaying(true);
    setPlayMin(0);
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(maxEta, Math.floor(((now - start) / 14000) * maxEta));
      setPlayMin(t);
      if (t < maxEta) playRaf.current = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    playRaf.current = requestAnimationFrame(tick);
  }, [solution]);

  const riskBuckets = useMemo(() => {
    let high = 0;
    let medium = 0;
    let low = 0;
    const items: { order_id: string; p: number; level: string; reasons: string[] }[] = [];
    if (!solution) return { high, medium, low, items };
    for (const r of solution.routes) {
      for (const s of r.stops) {
        const p = s.risk?.p_late ?? 0;
        const level = p >= 0.55 ? "HIGH" : p >= 0.35 ? "MEDIUM" : "LOW";
        if (level === "HIGH") high++;
        else if (level === "MEDIUM") medium++;
        else low++;
        items.push({ order_id: s.order_id, p, level, reasons: s.risk?.reasons ?? [] });
      }
    }
    items.sort((a, b) => b.p - a.p);
    return { high, medium, low, items };
  }, [solution]);

  const selectedStop: Stop | null = useMemo(() => {
    if (!selectedId || !solution) return null;
    for (const r of solution.routes) {
      const s = r.stops.find((x) => x.order_id === selectedId);
      if (s) return s;
    }
    return null;
  }, [selectedId, solution]);

  const statusLabel = useMemo(() => {
    if (!solution) return null;
    if (!solution.feasible && !solution.partial) return { text: "INFEASIBLE", tone: "bad" as const };
    if (solution.partial) return { text: "PARTIAL PLAN", tone: "warn" as const };
    return { text: "FEASIBLE", tone: "ok" as const };
  }, [solution]);

  const vehicleIds = scenario?.vehicles.map((v) => v.vehicle_id) ?? [];

  return (
    <div className="min-h-dvh bg-paper text-ink">
      {/* Header */}
      <header className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-hairline bg-snow px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <BrandLogo className="h-8 w-8" />
          <div>
            <h1 className="font-sans text-[16px] font-semibold tracking-tight sm:text-[18px]">NEXUS OPTIMIZER LAB</h1>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-mute">Last-mile delivery optimization</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy != null}
            onClick={() => void loadSynthetic()}
            className="inline-flex min-h-10 items-center gap-1.5 border border-hairline bg-snow px-3 font-sans text-[13px] font-semibold hover:border-ink disabled:opacity-40"
          >
            {busy === "synthetic" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles size={14} />}
            New Scenario
          </button>
          <button
            type="button"
            onClick={onBack}
            className="min-h-10 px-3 font-sans text-[13px] font-semibold text-mute hover:text-ink"
          >
            ← Presentation
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
        {error && (
          <div className="mb-4 flex items-start justify-between gap-3 border border-coral bg-[#FFF5F2] px-4 py-3 font-sans text-[14px]">
            <span>{error}</span>
            <button type="button" className="underline" onClick={() => setError(null)}>
              Dismiss
            </button>
          </div>
        )}

        {/* Empty state */}
        {!scenario && (
          <section className="flex min-h-[70dvh] flex-col items-center justify-center border border-hairline bg-snow px-6 py-16 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-coral">Nexus Optimizer Lab</p>
            <h2 className="mt-3 max-w-lg font-sans text-[clamp(1.6rem,4vw,2.4rem)] font-semibold leading-tight">
              Generate a fresh Bengaluru delivery scenario and optimize it.
            </h2>
            <p className="mt-3 max-w-md font-sans text-[15px] text-mute">
              Every load creates a new valid CVRPTW instance. Optimization uses Google OR-Tools and GradientBoosting late-risk.
            </p>
            <button
              type="button"
              disabled={busy != null}
              onClick={() => void loadSynthetic()}
              className="mt-8 inline-flex min-h-12 items-center gap-2 bg-coral px-8 font-sans text-[15px] font-semibold text-ink disabled:opacity-40"
            >
              {busy === "synthetic" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating scenario…
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Load Synthetic Scenario
                </>
              )}
            </button>
            <button type="button" onClick={onBack} className="mt-4 font-sans text-[13px] text-mute underline">
              Back to Presentation
            </button>
          </section>
        )}

        {scenario && payload && (
          <div className="flex flex-col gap-4">
            {/* Summary bar */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border border-hairline bg-snow px-4 py-3">
              <SummaryChip label="Orders" value={payload.summary.orders} />
              <SummaryChip label="Vehicles" value={payload.summary.vehicles} />
              <SummaryChip label="Critical" value={payload.summary.critical} />
              <SummaryChip label="Demand" value={payload.summary.total_demand} />
              <span className="font-mono text-[10px] text-mute">
                {payload.generation_id ?? payload.scenario_id}
              </span>
              <div className="ml-auto flex flex-wrap gap-2">
                <button type="button" onClick={() => setDrawer("orders")} className={chipBtn}>
                  View Orders
                </button>
                <button type="button" onClick={() => setDrawer("vehicles")} className={chipBtn}>
                  View Vehicles
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy != null}
                onClick={() => void optimize([], "optimize")}
                className="inline-flex min-h-11 items-center gap-2 bg-coral px-5 font-sans text-[14px] font-semibold text-ink disabled:opacity-40"
              >
                {busy === "optimize" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Optimizing routes…
                  </>
                ) : (
                  "Optimize Routes"
                )}
              </button>
              <button
                type="button"
                disabled={busy != null || !solution}
                onClick={() => startPlay()}
                className={chipBtn}
              >
                Play day{playMin != null ? ` · ${Math.floor(playMin / 60)}:${String(playMin % 60).padStart(2, "0")}` : ""}
              </button>
              <button
                type="button"
                disabled={busy != null || !solution || Boolean(excluded.length)}
                onClick={() => setBreakdownPick(true)}
                className={chipBtn}
              >
                <AlertTriangle size={14} /> Simulate Breakdown
              </button>
              {excluded.length > 0 && (
                <button
                  type="button"
                  disabled={busy != null}
                  onClick={reoptimize}
                  className="inline-flex min-h-11 items-center gap-2 border border-coral bg-[#FFF5F2] px-4 font-sans text-[13px] font-semibold disabled:opacity-40"
                >
                  {busy === "reoptimize" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Recalculating…
                    </>
                  ) : (
                    `Reoptimize without ${excluded.join(", ")}`
                  )}
                </button>
              )}
            </div>

            {/* Comparison + status */}
            {solution && baseline && (
              <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                <div className="overflow-x-auto border border-hairline bg-snow">
                  <table className="w-full min-w-[420px] text-left font-sans text-[14px]">
                    <thead>
                      <tr className="border-b border-hairline text-[12px] uppercase tracking-wide text-mute">
                        <th className="px-4 py-2 font-medium">Optimization result</th>
                        <th className="px-4 py-2 font-medium">Baseline</th>
                        <th className="px-4 py-2 font-medium text-coral">Nexus</th>
                      </tr>
                    </thead>
                    <tbody>
                      <MetricRow label="Distance (km)" a={baseline.metrics.distance_km} b={solution.metrics.distance_km} />
                      <MetricRow label="Late" a={baseline.metrics.late_count} b={solution.metrics.late_count} />
                      <MetricRow label="Breaches" a={baseline.metrics.hard_breaches} b={solution.metrics.hard_breaches} />
                      <MetricRow
                        label="Deferred"
                        a={baseline.metrics.unassigned_count}
                        b={solution.metrics.unassigned_count}
                      />
                    </tbody>
                  </table>
                </div>
                <div className="flex min-w-[160px] flex-col justify-center gap-2 border border-hairline bg-snow px-4 py-3">
                  {statusLabel && (
                    <p
                      className={`font-sans text-[13px] font-semibold ${
                        statusLabel.tone === "ok"
                          ? "text-ink"
                          : statusLabel.tone === "warn"
                            ? "text-coral"
                            : "text-coral"
                      }`}
                    >
                      {statusLabel.text}
                    </p>
                  )}
                  {solution.partial && (
                    <p className="font-sans text-[12px] text-mute">
                      Some deliveries could not be assigned under current constraints.
                    </p>
                  )}
                  <button type="button" onClick={() => setDrawer("risk")} className={`${chipBtn} w-full justify-center`}>
                    Risk · H{riskBuckets.high} M{riskBuckets.medium} L{riskBuckets.low}
                  </button>
                </div>
              </div>
            )}

            {excluded.length > 0 && (
              <div className="flex items-center gap-3 border border-coral bg-[#FFF5F2] px-4 py-3 font-sans text-[14px]">
                <AlertTriangle className="shrink-0 text-coral" size={18} />
                <div>
                  <p className="font-semibold">⚠ Vehicle disruption — {excluded.join(", ")} unavailable</p>
                  <p className="text-[13px] text-mute">
                    {disruptedOrderIds.length} deliveries were on that route. Reoptimize to rebuild the plan.
                  </p>
                </div>
              </div>
            )}

            {/* Map + filters */}
            <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
              <div className="relative border border-hairline bg-snow">
                <div className="flex flex-wrap items-center gap-1 border-b border-hairline px-3 py-2">
                  <span className="mr-2 font-mono text-[10px] uppercase tracking-wide text-mute">
                    <MapIcon size={12} className="mr-1 inline" />
                    Filter
                  </span>
                  <FilterChip active={!focusVehicle} onClick={() => setFocusVehicle(null)} label="ALL" />
                  {vehicleIds.map((vid) => (
                    <FilterChip
                      key={vid}
                      active={focusVehicle === vid}
                      onClick={() => setFocusVehicle(vid === focusVehicle ? null : vid)}
                      label={vid}
                      color={vehicleVisual(vid).color}
                      muted={excluded.includes(vid)}
                    />
                  ))}
                </div>
                <div className="h-[min(62vh,640px)] min-h-[420px]">
                  <LabMap
                    scenario={scenario}
                    solution={solution}
                    selectedId={selectedId}
                    focusVehicle={focusVehicle}
                    excludedVehicles={excluded}
                    disruptedOrderIds={disruptedOrderIds}
                    playMin={playing || playMin != null ? playMin : null}
                    onSelect={setSelectedId}
                  />
                </div>
                {/* Legend */}
                <div className="absolute bottom-3 left-3 z-[500] max-w-[220px] border border-ink bg-snow/95 text-[11px] shadow-sm backdrop-blur">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 font-sans text-[11px] font-semibold"
                    onClick={() => setLegendOpen((v) => !v)}
                  >
                    Map legend
                    {legendOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                  </button>
                  {legendOpen && (
                    <ul className="space-y-1.5 border-t border-hairline px-3 py-2 font-sans text-mute">
                      <li className="flex items-center gap-2">
                        <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-ink bg-[#92CFF2]" /> Depot
                      </li>
                      {(solution?.routes.length
                        ? solution.routes.map((r) => r.vehicle_id)
                        : scenario.vehicles.map((v) => v.vehicle_id)
                      )
                        .slice(0, 6)
                        .map((vid) => {
                          const vis = vehicleVisual(vid);
                          return (
                            <li key={vid} className="flex items-center gap-2">
                              <span
                                className="inline-block w-8 border-t-2"
                                style={{
                                  borderColor: vis.color,
                                  borderStyle: patternCss(vis.patternLabel) as "solid" | "dashed" | "dotted",
                                }}
                              />
                              {vid}
                              {excluded.includes(vid) ? " ⚠" : ""}
                            </li>
                          );
                        })}
                      <li>○ Normal · ◆ Critical · ! High risk</li>
                      <li>× Deferred · ⚠ Breakdown</li>
                    </ul>
                  )}
                </div>
              </div>

              {/* Route cards */}
              <aside className="flex max-h-[min(62vh,640px)] flex-col gap-2 overflow-y-auto">
                <p className="font-mono text-[10px] uppercase tracking-wide text-mute">Routes</p>
                {(solution?.routes ?? []).map((route) => {
                  const vis = vehicleVisual(route.vehicle_id);
                  const down = excluded.includes(route.vehicle_id);
                  return (
                    <button
                      key={route.vehicle_id}
                      type="button"
                      onClick={() => setFocusVehicle(route.vehicle_id === focusVehicle ? null : route.vehicle_id)}
                      className={`border bg-snow p-3 text-left ${
                        focusVehicle === route.vehicle_id ? "border-ink" : "border-hairline"
                      } ${down ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5" style={{ background: vis.color }} />
                        <span className="font-sans text-[14px] font-semibold">{route.vehicle_id}</span>
                        {down && <span className="text-[10px] font-semibold text-coral">DOWN</span>}
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-mute">
                        {route.stops.length} stops · {routeDistanceKm(route)} km · {route.load}/{route.capacity} kg
                      </p>
                      <p className="font-sans text-[12px] text-mute">{route.driver || "—"}</p>
                    </button>
                  );
                })}
                {excluded
                  .filter((vid) => !(solution?.routes ?? []).some((r) => r.vehicle_id === vid))
                  .map((vid) => (
                    <div key={vid} className="border border-coral bg-[#FFF5F2] p-3 opacity-80">
                      <p className="font-sans text-[14px] font-semibold">⚠ {vid} UNAVAILABLE</p>
                      <p className="font-mono text-[11px] text-mute">Excluded from reoptimized plan</p>
                    </div>
                  ))}
                {!solution && (
                  <p className="font-sans text-[13px] text-mute">Run Optimize Routes to assign vans.</p>
                )}
              </aside>
            </div>

            {selectedStop && (
              <div className="border border-hairline bg-snow px-4 py-3 font-sans text-[13px]">
                <p className="font-semibold">
                  {selectedStop.order_id} · late risk {Math.round((selectedStop.risk?.p_late ?? 0) * 100)}%
                </p>
                <p className="text-mute">{(selectedStop.risk?.reasons ?? []).slice(0, 3).join(" · ") || "No reason list"}</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Breakdown picker */}
      {breakdownPick && solution && (
        <Modal title="Simulate vehicle breakdown" onClose={() => setBreakdownPick(false)}>
          <p className="mb-4 font-sans text-[14px] text-mute">Choose an active van to mark unavailable.</p>
          <div className="flex flex-col gap-2">
            {solution.routes
              .filter((r) => r.stops.length > 0)
              .map((r) => (
                <button
                  key={r.vehicle_id}
                  type="button"
                  onClick={() => startBreakdown(r.vehicle_id)}
                  className="border border-hairline px-4 py-3 text-left font-sans text-[14px] font-semibold hover:border-coral"
                >
                  {r.vehicle_id} · {r.driver} · {r.stops.length} stops
                </button>
              ))}
          </div>
        </Modal>
      )}

      {drawer === "orders" && scenario && (
        <Modal title="Orders" onClose={() => setDrawer(null)}>
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto font-sans text-[13px]">
            {scenario.orders.map((o) => (
              <li key={o.order_id} className="border-b border-hairline pb-2">
                <span className="font-semibold">{o.order_id}</span> · {o.customer} · {o.demand}kg ·{" "}
                {o.priority === "critical" ? "CRITICAL" : "normal"}
              </li>
            ))}
          </ul>
        </Modal>
      )}
      {drawer === "vehicles" && scenario && (
        <Modal title="Vehicles" onClose={() => setDrawer(null)}>
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto font-sans text-[13px]">
            {scenario.vehicles.map((v) => (
              <li key={v.vehicle_id} className="border-b border-hairline pb-2">
                <span className="font-semibold">{v.vehicle_id}</span> · {v.driver} · cap {v.capacity} · {v.plate}
              </li>
            ))}
          </ul>
        </Modal>
      )}
      {drawer === "risk" && (
        <Modal title="Late-delivery risk" onClose={() => setDrawer(null)}>
          <p className="mb-3 font-sans text-[13px] text-mute">
            GradientBoostingClassifier · High {riskBuckets.high} · Medium {riskBuckets.medium} · Low {riskBuckets.low}
          </p>
          <ul className="max-h-[55vh] space-y-2 overflow-y-auto font-sans text-[13px]">
            {riskBuckets.items.slice(0, 40).map((it) => (
              <li key={it.order_id}>
                <button
                  type="button"
                  className="w-full border-b border-hairline pb-2 text-left hover:text-coral"
                  onClick={() => {
                    setSelectedId(it.order_id);
                    setDrawer(null);
                  }}
                >
                  <span className="font-semibold">{it.order_id}</span> · {it.level} · {Math.round(it.p * 100)}%
                  {it.reasons[0] ? ` · ${it.reasons[0]}` : ""}
                </button>
              </li>
            ))}
            {!riskBuckets.items.length && <li className="text-mute">Optimize first to see risk scores.</li>}
          </ul>
        </Modal>
      )}
    </div>
  );
}

const chipBtn =
  "inline-flex min-h-11 items-center gap-1.5 border border-hairline bg-snow px-3 font-sans text-[13px] font-semibold hover:border-ink disabled:opacity-40";

function SummaryChip({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-wide text-mute">{label}</p>
      <p className="font-sans text-[18px] font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function MetricRow({ label, a, b }: { label: string; a: number; b: number }) {
  return (
    <tr className="border-b border-hairline last:border-0">
      <td className="px-4 py-2.5">{label}</td>
      <td className="px-4 py-2.5 tabular-nums text-mute">{typeof a === "number" && a % 1 ? a.toFixed(1) : a}</td>
      <td className="px-4 py-2.5 tabular-nums font-semibold">{typeof b === "number" && b % 1 ? b.toFixed(1) : b}</td>
    </tr>
  );
}

function FilterChip({
  label,
  active,
  onClick,
  color,
  muted,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-8 px-2.5 font-mono text-[11px] font-semibold ${
        active ? "bg-ink text-snow" : "bg-paper text-mute hover:text-ink"
      } ${muted ? "line-through opacity-50" : ""}`}
      style={color && !active ? { boxShadow: `inset 0 -2px 0 ${color}` } : undefined}
    >
      {label}
    </button>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <div className="max-h-[90dvh] w-full max-w-lg overflow-hidden border border-ink bg-snow shadow-card">
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
          <h3 className="font-sans text-[16px] font-semibold">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
}
