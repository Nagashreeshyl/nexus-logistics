import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CityMap } from "../components/CityMap";
import {
  loadSyntheticScenario,
  runLabOptimize,
  type LabRunResult,
  type LabScenarioPayload,
} from "../lib/labApi";
import { writeLabSession } from "../lib/labSession";
import type { ScenarioDetail, Solution } from "../types";

type Drawer = "orders" | "vehicles" | "risk" | "tech" | null;
type Phase = "idle" | "loading" | "ready" | "optimizing" | "done" | "error";

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
  const [hoverVehicle, setHoverVehicle] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [breakdownVehicle, setBreakdownVehicle] = useState<string>("");
  const [excluded, setExcluded] = useState<string[]>([]);
  const [busyBreak, setBusyBreak] = useState(false);

  const mapScenario = useMemo(() => (scenario ? toScenarioDetail(scenario) : null), [scenario]);
  const activeSolution: Solution | null = result?.optimize ?? null;

  const riskStops = useMemo(() => {
    if (!result) return [];
    const stops = result.optimize.routes.flatMap((r) => r.stops.map((s) => ({ ...s, vehicle_id: r.vehicle_id })));
    return stops
      .filter((s) => s.risk)
      .sort((a, b) => (b.risk?.p_late ?? 0) - (a.risk?.p_late ?? 0));
  }, [result]);

  async function onLoadScenario() {
    setError(null);
    setResult(null);
    setPriorResult(null);
    setExcluded([]);
    setBreakdownVehicle("");
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

  async function onBreakdownReopt() {
    if (!scenario || !breakdownVehicle) return;
    setBusyBreak(true);
    setError(null);
    try {
      const nextExcluded = Array.from(new Set([...excluded, breakdownVehicle]));
      setPriorResult(result);
      setPhase("optimizing");
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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    } finally {
      setBusyBreak(false);
    }
  }

  function backToPresentation() {
    writeLabSession({ returnTo, slide: fromSlide ? Number(fromSlide) : undefined });
    navigate(returnTo);
  }

  const before = result?.baseline.metrics;
  const nexus = result?.optimize.metrics;

  return (
    <div className="min-h-[calc(100dvh-65px)] bg-[#101218] px-4 py-8 text-[#f2efe8] md:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#f47c59]">Workbench</p>
            <h1 className="mt-1 font-sans text-[clamp(1.8rem,4vw,2.6rem)] font-semibold tracking-tight">
              Nexus Optimizer Lab
            </h1>
            <p className="mt-2 max-w-xl font-sans text-[15px] text-[#a8adb8]">
              Generate a delivery scenario and optimize it with the real CVRPTW engine.
            </p>
          </div>
          <button
            type="button"
            onClick={backToPresentation}
            className="border border-white/15 px-3 py-2 font-sans text-[13px] font-semibold text-[#c5c8cf] hover:text-white"
          >
            ← Back to Presentation
          </button>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={phase === "loading" || phase === "optimizing"}
            onClick={() => void onLoadScenario()}
            className="bg-[#f47c59] px-5 py-3 font-sans text-[14px] font-semibold text-[#0c0d10] disabled:opacity-40"
          >
            {phase === "loading" ? "Generating…" : "Load Synthetic Scenario"}
          </button>
          {scenario && (
            <button
              type="button"
              disabled={phase === "optimizing" || phase === "loading"}
              onClick={() => void onOptimize()}
              className="border border-[#92cff2]/50 bg-[#92cff2]/10 px-5 py-3 font-sans text-[14px] font-semibold text-[#92cff2] disabled:opacity-40"
            >
              {phase === "optimizing" ? "Optimizing…" : "Optimize Routes"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setDrawer("tech")}
            className="border border-white/15 px-4 py-3 font-sans text-[13px] font-semibold text-[#a8adb8]"
          >
            Technical Details
          </button>
        </div>

        {error && (
          <div className="mt-4 border border-[#f47c59]/50 bg-[#f47c59]/10 px-4 py-3 font-sans text-[14px] text-[#f2efe8]">
            {error}
          </div>
        )}

        {phase === "optimizing" && (
          <div className="mt-6 border border-white/10 px-4 py-6 text-center">
            <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-[#92cff2]">Optimizing routes…</p>
            <p className="mt-2 font-sans text-[14px] text-[#a8adb8]">
              Running baseline heuristic + OR-Tools CVRPTW + late-risk model
            </p>
          </div>
        )}

        {scenario && (
          <section className="mt-8">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Orders", scenario.summary.orders],
                ["Vehicles", scenario.summary.vehicles],
                ["Critical", scenario.summary.critical],
                ["Total demand", scenario.summary.total_demand],
              ].map(([label, value]) => (
                <div key={String(label)} className="border border-white/10 bg-white/[0.03] px-4 py-3">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-[#8b909a]">{label}</p>
                  <p className="mt-1 font-sans text-[24px] font-semibold tabular">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDrawer("orders")}
                className="border border-white/15 px-3 py-1.5 font-sans text-[12px] font-semibold text-[#c5c8cf]"
              >
                View Orders
              </button>
              <button
                type="button"
                onClick={() => setDrawer("vehicles")}
                className="border border-white/15 px-3 py-1.5 font-sans text-[12px] font-semibold text-[#c5c8cf]"
              >
                View Vehicles
              </button>
              <p className="self-center font-mono text-[11px] text-[#8b909a]">id {scenario.scenario_id}</p>
            </div>
          </section>
        )}

        {result && (
          <section className="mt-10 space-y-8">
            {!result.feasible && (
              <div className="border border-[#f47c59] px-4 py-3 font-sans text-[14px]">
                Infeasible under hard constraints — no complete assignment. Deferred orders are listed below.
              </div>
            )}
            {result.partial && result.feasible && (
              <div className="border border-[#f47c59]/40 px-4 py-3 font-sans text-[14px] text-[#c5c8cf]">
                Partial plan: some orders deferred to protect capacity and time windows.
              </div>
            )}

            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#8b909a]">Before vs Nexus</p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full max-w-xl border-collapse text-left font-sans text-[14px]">
                  <thead>
                    <tr className="border-b border-white/15 text-[#8b909a]">
                      <th className="py-2 pr-4 font-medium">Metric</th>
                      <th className="py-2 pr-4 font-medium">Before</th>
                      <th className="py-2 font-medium text-[#f47c59]">Nexus</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-white/8 text-[#c5c8cf]">
                      <td className="py-2.5 pr-4">Distance (km)</td>
                      <td className="py-2.5 pr-4 tabular">{before?.distance_km ?? "—"}</td>
                      <td className="py-2.5 tabular text-[#f2efe8]">{nexus?.distance_km ?? "—"}</td>
                    </tr>
                    <tr className="border-b border-white/8 text-[#c5c8cf]">
                      <td className="py-2.5 pr-4">Late deliveries</td>
                      <td className="py-2.5 pr-4 tabular">{before?.late_count ?? "—"}</td>
                      <td className="py-2.5 tabular text-[#f2efe8]">{nexus?.late_count ?? "—"}</td>
                    </tr>
                    <tr className="border-b border-white/8 text-[#c5c8cf]">
                      <td className="py-2.5 pr-4">Hard breaches</td>
                      <td className="py-2.5 pr-4 tabular">{before?.hard_breaches ?? "—"}</td>
                      <td className="py-2.5 tabular text-[#f2efe8]">{nexus?.hard_breaches ?? "—"}</td>
                    </tr>
                    <tr className="border-b border-white/8 text-[#c5c8cf]">
                      <td className="py-2.5 pr-4">Deferred</td>
                      <td className="py-2.5 pr-4 tabular">{before?.unassigned_count ?? "—"}</td>
                      <td className="py-2.5 tabular text-[#f2efe8]">{nexus?.unassigned_count ?? "—"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-2 font-mono text-[11px] text-[#8b909a]">
                Travel: {result.travel_source.optimize}
                {excluded.length ? ` · excluded ${excluded.join(", ")}` : ""}
              </p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#8b909a]">Route map</p>
                <button
                  type="button"
                  onClick={() => setDrawer("risk")}
                  className="font-sans text-[12px] font-semibold text-[#f47c59]"
                >
                  Late risk · Why?
                </button>
              </div>
              <div className="h-[360px] overflow-hidden border border-white/10 bg-[#0c0d10]">
                {mapScenario && (
                  <CityMap
                    scenario={mapScenario}
                    solution={activeSolution}
                    selectedId={selectedId}
                    hoverVehicle={hoverVehicle}
                    playMin={null}
                    onSelect={setSelectedId}
                  />
                )}
              </div>
            </div>

            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#8b909a]">Routes</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {result.optimize.routes.map((route) => (
                  <button
                    key={route.vehicle_id}
                    type="button"
                    onClick={() => setHoverVehicle((v) => (v === route.vehicle_id ? null : route.vehicle_id))}
                    className={`border px-4 py-3 text-left transition ${
                      hoverVehicle === route.vehicle_id
                        ? "border-[#f47c59] bg-[#f47c59]/10"
                        : "border-white/10 bg-white/[0.02] hover:border-white/25"
                    }`}
                  >
                    <p className="font-sans text-[15px] font-semibold">
                      {route.vehicle_id}
                      <span className="ml-2 font-mono text-[11px] font-normal text-[#8b909a]">
                        {route.load}/{route.capacity} · {route.stops.length} stops
                      </span>
                    </p>
                    <p className="mt-2 font-mono text-[12px] leading-relaxed text-[#a8adb8]">
                      Depot
                      {route.stops.map((s) => ` → ${s.order_id}`).join("")}
                      {route.stops.length ? " → Depot" : ""}
                    </p>
                  </button>
                ))}
              </div>
              {result.optimize.unassigned.length > 0 && (
                <p className="mt-3 font-sans text-[13px] text-[#f47c59]">
                  Deferred: {result.optimize.unassigned.map((u) => u.order_id).join(", ")}
                </p>
              )}
            </div>

            {priorResult && (
              <div className="border border-white/10 px-4 py-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#f47c59]">Disruption story</p>
                <ol className="mt-3 grid gap-2 font-sans text-[13px] text-[#c5c8cf] sm:grid-cols-4">
                  <li>
                    <span className="font-semibold text-[#f2efe8]">1. Original</span>
                    <br />
                    {priorResult.optimize.metrics.distance_km} km · {priorResult.optimize.metrics.late_count} late
                  </li>
                  <li>
                    <span className="font-semibold text-[#f2efe8]">2. Breakdown</span>
                    <br />
                    {excluded.join(", ") || "—"} unavailable
                  </li>
                  <li>
                    <span className="font-semibold text-[#f2efe8]">3. Reoptimize</span>
                    <br />
                    Real OR-Tools re-run
                  </li>
                  <li>
                    <span className="font-semibold text-[#f2efe8]">4. New plan</span>
                    <br />
                    {result.optimize.metrics.distance_km} km · {result.optimize.metrics.late_count} late
                  </li>
                </ol>
              </div>
            )}

            <div className="border border-white/10 px-4 py-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#8b909a]">
                Simulate vehicle breakdown
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="block font-sans text-[13px] text-[#a8adb8]">
                  Active vehicle
                  <select
                    className="mt-1 block min-w-[160px] border border-white/15 bg-[#0c0d10] px-3 py-2 text-[#f2efe8]"
                    value={breakdownVehicle}
                    onChange={(e) => setBreakdownVehicle(e.target.value)}
                  >
                    <option value="">Select…</option>
                    {scenario?.vehicles
                      .filter((v) => !excluded.includes(v.vehicle_id))
                      .map((v) => (
                        <option key={v.vehicle_id} value={v.vehicle_id}>
                          {v.vehicle_id} · {v.plate}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={!breakdownVehicle || busyBreak || phase === "optimizing"}
                  onClick={() => void onBreakdownReopt()}
                  className="bg-[#f47c59] px-4 py-2.5 font-sans text-[13px] font-semibold text-[#0c0d10] disabled:opacity-40"
                >
                  {busyBreak ? "Reoptimizing…" : "Reoptimize"}
                </button>
              </div>
              {breakdownVehicle && result && (
                <p className="mt-3 font-sans text-[13px] text-[#a8adb8]">
                  Affected on current plan:{" "}
                  {(
                    result.optimize.routes.find((r) => r.vehicle_id === breakdownVehicle)?.stops.map((s) => s.order_id) ??
                    []
                  ).join(", ") || "none assigned"}
                </p>
              )}
            </div>
          </section>
        )}

        {!scenario && phase === "idle" && (
          <p className="mt-16 font-sans text-[15px] text-[#8b909a]">
            Start with <span className="text-[#f2efe8]">Load Synthetic Scenario</span> — each click builds a new
            Bengaluru day.
          </p>
        )}
      </div>

      {drawer && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-black/50"
          role="dialog"
          onClick={() => setDrawer(null)}
        >
          <div
            className="h-full w-full max-w-md overflow-auto border-l border-white/10 bg-[#14161c] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-sans text-[16px] font-semibold">
                {drawer === "orders" && "Orders"}
                {drawer === "vehicles" && "Vehicles"}
                {drawer === "risk" && "Late-delivery risk"}
                {drawer === "tech" && "Technical Details"}
              </h3>
              <button type="button" className="text-[#8b909a]" onClick={() => setDrawer(null)}>
                Close
              </button>
            </div>

            {drawer === "orders" && scenario && (
              <ul className="mt-4 space-y-2 font-sans text-[13px]">
                {scenario.orders.map((o) => (
                  <li key={o.order_id} className="border-b border-white/8 py-2">
                    <span className="font-semibold">{o.order_id}</span> · {o.customer}
                    <br />
                    <span className="text-[#8b909a]">
                      {o.demand} demand · {o.priority} · window {o.tw_start}–{o.tw_end} min
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {drawer === "vehicles" && scenario && (
              <ul className="mt-4 space-y-2 font-sans text-[13px]">
                {scenario.vehicles.map((v) => (
                  <li key={v.vehicle_id} className="border-b border-white/8 py-2">
                    <span className="font-semibold">{v.vehicle_id}</span> · {v.driver}
                    <br />
                    <span className="text-[#8b909a]">
                      cap {v.capacity} · {v.plate}
                      {excluded.includes(v.vehicle_id) ? " · BREAKDOWN" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {drawer === "risk" && (
              <div className="mt-4 space-y-3 font-sans text-[13px] text-[#c5c8cf]">
                <p>
                  Predicted late-delivery risk based on operational delivery features (depot distance, window width,
                  demand, zone rates, and planned sequence when available).
                </p>
                <p className="font-mono text-[11px] text-[#8b909a]">Model: GradientBoostingClassifier</p>
                {riskStops.slice(0, 12).map((s) => (
                  <div key={s.order_id} className="border border-white/10 px-3 py-2">
                    <div className="flex justify-between">
                      <span className="font-semibold text-[#f2efe8]">{s.order_id}</span>
                      <span
                        className={
                          riskBand(s.risk!.p_late) === "HIGH"
                            ? "text-[#f47c59]"
                            : riskBand(s.risk!.p_late) === "MEDIUM"
                              ? "text-[#92cff2]"
                              : "text-[#8b909a]"
                        }
                      >
                        {riskBand(s.risk!.p_late)} · {(s.risk!.p_late * 100).toFixed(0)}%
                      </span>
                    </div>
                    {(s.risk?.reasons ?? []).slice(0, 2).map((r) => (
                      <p key={r} className="mt-1 text-[12px] text-[#8b909a]">
                        {r}
                      </p>
                    ))}
                  </div>
                ))}
                {!riskStops.length && <p>Run optimize to attach risk scores to stops.</p>}
              </div>
            )}

            {drawer === "tech" && (
              <dl className="mt-4 space-y-3 font-sans text-[13px]">
                <div>
                  <dt className="text-[#8b909a]">Pipeline</dt>
                  <dd>POST /api/lab/synthetic → POST /api/lab/run (auth-optional)</dd>
                </div>
                <div>
                  <dt className="text-[#8b909a]">Algorithm</dt>
                  <dd>CVRPTW · Google OR-Tools</dd>
                </div>
                <div>
                  <dt className="text-[#8b909a]">ML</dt>
                  <dd>GradientBoostingClassifier</dd>
                </div>
                <div>
                  <dt className="text-[#8b909a]">Why this path</dt>
                  <dd>
                    Same engines as /api/ops/optimize-live, without Firebase auth friction for the hackathon demo.
                    Fresh scenario each Load click — not static A/B packs.
                  </dd>
                </div>
                <Link to="/lab" className="inline-block text-[#f47c59]">
                  Legacy dense Lab (/lab)
                </Link>
              </dl>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
