import { useCallback, useEffect, useMemo, useState } from "react";
import { Cloud, Download, FileText, HelpCircle, Loader2, Map as MapIcon, Play, Sparkles, X, Zap } from "lucide-react";
import { apiUrl } from "../lib/apiUrl";
import {
  clearHolds,
  compare,
  fetchHistory,
  fetchScenario,
  refreshWeather,
  setHold,
  solve,
  type ComparisonRow,
} from "../api";
import { CityMap } from "../components/CityMap";
import { ComparisonTable } from "../components/ComparisonTable";
import { ConstraintLog } from "../components/ConstraintLog";
import { DeferredList } from "../components/DeferredList";
import { ExceptionStory } from "../components/ExceptionStory";
import { ExportViewer, type ExportKind } from "../components/ExportViewer";
import { DisruptionPanel } from "../components/DisruptionPanel";
import { HistoryPanel } from "../components/HistoryPanel";
import { Jp019Checklist } from "../components/Jp019Checklist";
import { LoadingOverlay } from "../components/LoadingOverlay";
import { MeasuredImprovement } from "../components/MeasuredImprovement";
import { OrderBoard } from "../components/OrderBoard";
import { WhyThisRoute } from "../components/WhyThisRoute";
import { Scoreboard } from "../components/Scoreboard";
import { BrandLogo } from "../components/BrandLogo";
import { VehicleRail } from "../components/VehicleRail";
import { WinSheetPanel } from "../components/WinSheetPanel";
import { fmtClock } from "../lib/format";
import { loadSyntheticScenario, runLabOptimize, type LabArchetype } from "../lib/labApi";
import { persistLabCompareSession, writeLabSession } from "../lib/labSession";
import type { Metrics, Order, RoutePlan, ScenarioDetail, Solution, SolveMode, Stop, Weather } from "../types";

interface ConsoleProps {
  onBack: () => void;
}

type BusyMode = SolveMode | "compare" | "synthetic" | "breakdown" | "rush" | null;
/** Day packs a/b plus live synthetic pack persisted as SQLite id `lab`. */
type DayId = "a" | "b" | "lab";
type PlaySpeed = 0.5 | 1 | 2 | 4;
type MapTimeline = "after" | "before";

const PLAY_SPEEDS: PlaySpeed[] = [0.5, 1, 2, 4];
const BASE_PLAY_MS = 12_000;

const ARCHETYPE_OPTIONS: { id: LabArchetype; label: string; hint: string }[] = [
  { id: "balanced", label: "Balanced", hint: "Typical day" },
  { id: "surge", label: "Surge", hint: "More orders / criticals" },
  { id: "tight_windows", label: "Tight windows", hint: "Narrow TW pressure" },
  { id: "fleet_shortage", label: "Fleet short", hint: "Fewer vans" },
];

function pickHighestRiskOrderId(sol: Solution, minP = 0.55): string | null {
  let bestId: string | null = null;
  let bestP = -1;
  for (const r of sol.routes) {
    for (const s of r.stops) {
      const p = s.risk?.p_late ?? 0;
      if (p > bestP) {
        bestP = p;
        bestId = s.order_id;
      }
    }
  }
  return bestP >= minP ? bestId : null;
}

export function Console({ onBack }: ConsoleProps) {
  const [scenarioId, setScenarioId] = useState<DayId>("a");
  const [labGenerationId, setLabGenerationId] = useState<string | null>(null);
  const [scenario, setScenario] = useState<ScenarioDetail | null>(null);
  const [scenarioLoading, setScenarioLoading] = useState(true);
  const [solution, setSolution] = useState<Solution | null>(null);
  const [baselines, setBaselines] = useState<Record<string, Metrics>>({});
  const [solving, setSolving] = useState<BusyMode>(null);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverVehicle, setHoverVehicle] = useState<string | null>(null);
  const [focusVehicle, setFocusVehicle] = useState<string | null>(null);
  const [breakdownVehicle, setBreakdownVehicle] = useState<string | null>(null);
  const [unavailableVehicleIds, setUnavailableVehicleIds] = useState<string[]>([]);
  const [preDisruption, setPreDisruption] = useState<Solution | null>(null);
  const [held, setHeld] = useState<string[]>([]);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [briefing, setBriefing] = useState<string[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [history, setHistory] = useState<
    {
      id: number;
      mode: string;
      travel_source: string;
      created_at: string;
      metrics: { late_count: number; distance_km: number; hard_breaches: number; unassigned_count: number };
    }[]
  >([]);
  const [cacheMode, setCacheMode] = useState<string>("");
  const [playMin, setPlayMin] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState<PlaySpeed>(1);
  const [exportKind, setExportKind] = useState<ExportKind | null>(null);
  const [clock, setClock] = useState(() => new Date());
  const [comparisonRows, setComparisonRows] = useState<ComparisonRow[]>([]);
  const [travelPair, setTravelPair] = useState<{ baseline: string; optimize: string } | null>(null);
  const [winOpen, setWinOpen] = useState(false);
  const [disclosure, setDisclosure] = useState<string>("");
  const [mapTimeline, setMapTimeline] = useState<MapTimeline>("after");
  const [archetype, setArchetype] = useState<LabArchetype>("balanced");
  const [rushOrderId, setRushOrderId] = useState<string | null>(null);
  const [comparedOnce, setComparedOnce] = useState(false);

  const isLab = scenarioId === "lab";

  useEffect(() => {
    const t = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    fetch(apiUrl("/api/health"))
      .then((r) => r.json())
      .then((h) => setCacheMode(h?.cache?.mode ? String(h.cache.mode) : ""))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!solving) {
      setStage(0);
      return;
    }
    setStage(0);
    const timers = [1, 2, 3, 4].map((i) => window.setTimeout(() => setStage(i), i * 1400));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [solving]);

  const reloadScenario = useCallback(async (id: string) => {
    setScenarioLoading(true);
    try {
      const s = await fetchScenario(id);
      setScenario(s);
      setHeld(s.held ?? []);
      if (s.weather) setWeather(s.weather);
    } finally {
      setScenarioLoading(false);
    }
  }, []);

  const reloadHistory = useCallback(async (id: string) => {
    try {
      const h = await fetchHistory(id);
      setHistory(h.items);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSolution(null);
    setSelectedId(null);
    setFocusVehicle(null);
    setBreakdownVehicle(null);
    setUnavailableVehicleIds([]);
    setPreDisruption(null);
    setError(null);
    setBriefing([]);
    setPlayMin(null);
    setPlaying(false);
    setComparisonRows([]);
    setTravelPair(null);
    setMapTimeline("after");
    setRushOrderId(null);
    setComparedOnce(false);
    if (scenarioId !== "lab") setLabGenerationId(null);
    Promise.all([reloadScenario(scenarioId), reloadHistory(scenarioId)]).catch((e: Error) => {
      if (!cancelled) {
        if (scenarioId === "lab") {
          setError("No synthetic scenario yet — click Load Scenario to generate one.");
          setScenario(null);
          setScenarioLoading(false);
        } else {
          setError(e.message);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [scenarioId, reloadScenario, reloadHistory]);

  const loadNewSynthetic = useCallback(
    async (nextArchetype?: LabArchetype) => {
      const arch = nextArchetype ?? archetype;
      if (nextArchetype) setArchetype(nextArchetype);
      setSolving("synthetic");
      setScenarioLoading(true);
      setError(null);
      setSolution(null);
      setSelectedId(null);
      setFocusVehicle(null);
      setBreakdownVehicle(null);
      setUnavailableVehicleIds([]);
      setPreDisruption(null);
      setHeld([]);
      setComparisonRows([]);
      setTravelPair(null);
      setPlayMin(null);
      setPlaying(false);
      setMapTimeline("after");
      setRushOrderId(null);
      setComparedOnce(false);
      try {
        const payload = await loadSyntheticScenario({ archetype: arch });
        setLabGenerationId(payload.generation_id ?? `lab-${payload.seed.toString(16)}`);
        setScenarioId("lab");
        await reloadScenario("lab");
        await reloadHistory("lab");
        const archLabel = ARCHETYPE_OPTIONS.find((a) => a.id === (payload.archetype ?? arch))?.label ?? arch;
        setBriefing([
          `SYNTHETIC DEMO · ${archLabel.toUpperCase()} — fresh Bengaluru day (new every Load).`,
          `${payload.summary.orders} orders · ${payload.summary.vehicles} vans · ${payload.summary.critical} critical · demand ${payload.summary.total_demand}.`,
          "Run Optimize to compare Baseline vs Nexus on this scenario.",
        ]);
        writeLabSession({
          scenario_id: "lab",
          summary: {
            orders: payload.summary.orders,
            vehicles: payload.summary.vehicles,
            critical: payload.summary.critical,
            total_demand: payload.summary.total_demand,
            generation_id: payload.generation_id ?? `lab-${payload.seed.toString(16)}`,
          },
        });
        setToast(
          `${archLabel} loaded · ${payload.summary.orders} orders · ${payload.summary.vehicles} vans · ${payload.summary.critical} critical`,
        );
        setShowHelp(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Synthetic load failed");
      } finally {
        setScenarioLoading(false);
        setSolving(null);
      }
    },
    [reloadScenario, reloadHistory, archetype],
  );

  const run = useCallback(
    async (mode: SolveMode) => {
      setSolving(mode);
      setError(null);
      setPlaying(false);
      setPlayMin(null);
      try {
        const result = await solve(scenarioId, mode);
        if (mode === "baseline") {
          setBaselines((prev) => ({ ...prev, [scenarioId]: result.metrics }));
        }
        await reloadHistory(scenarioId);
        setSolution(result);
        if (result.weather) setWeather(result.weather);
        setBriefing([
          mode === "baseline"
            ? "This is the weak plan (simple rules). Use it as the control."
            : "This is the smart plan. Compare the numbers above against the naive plan.",
          `Late stops: ${result.metrics.late_count}. Distance: ${result.metrics.distance_km.toFixed(1)} km.`,
          result.partial
            ? `${result.unassigned.length} stops could not fit without breaking rules. They are deferred.`
            : "Every stop was assigned without breaking capacity or time windows.",
          result.feasible && !result.partial
            ? "Feasible under hard constraints."
            : "Partial / constrained — not marked as fully optimized.",
        ]);
        // Persist real metrics for Presentation when we have a baseline+optimize pair or optimize alone.
        if (mode === "optimize") {
          const base = baselines[scenarioId] ?? result.metrics;
          const highRisk = result.routes.reduce(
            (n, r) => n + r.stops.filter((s) => (s.risk?.p_late ?? 0) >= 0.55).length,
            0,
          );
          persistLabCompareSession({
            scenarioId,
            orders: scenario?.orders.length ?? 0,
            vehicles: scenario?.vehicles.length ?? 0,
            critical: scenario?.orders.filter((o) => o.priority === "critical").length ?? 0,
            totalDemand: scenario?.orders.reduce((n, o) => n + o.demand, 0) ?? 0,
            generationId: labGenerationId,
            baseline: {
              distance_km: base.distance_km,
              late_count: base.late_count,
              hard_breaches: base.hard_breaches,
              unassigned_count: base.unassigned_count,
            },
            optimize: {
              distance_km: result.metrics.distance_km,
              late_count: result.metrics.late_count,
              hard_breaches: result.metrics.hard_breaches,
              unassigned_count: result.metrics.unassigned_count,
              feasible: result.feasible,
              partial: result.partial,
              criticals_served: result.metrics.criticals_served,
              time_min: result.metrics.time_min,
            },
            highRiskCount: highRisk,
            travelSource: result.travel_source,
          });
        }
        setToast(mode === "optimize" ? "Nexus plan ready. Check the map and scoreboard." : "Baseline plan ready.");
        setShowHelp(false);
        if (mode === "optimize") {
          const riskId = pickHighestRiskOrderId(result);
          if (riskId) setSelectedId(riskId);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Solve failed");
      } finally {
        setSolving(null);
      }
    },
    [scenarioId, reloadHistory, baselines, scenario, labGenerationId],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedId(null);
        setExportKind(null);
      }
      if (e.key === "1") setScenarioId("a");
      if (e.key === "2") setScenarioId("b");
      if (e.key === "3") void loadNewSynthetic();
      if (e.key === "b" && !e.metaKey && !e.ctrlKey) void run("baseline");
      if (e.key === "o" && !e.metaKey && !e.ctrlKey) void run("optimize");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run, loadNewSynthetic]);

  useEffect(() => {
    if (!playing || !solution) return;
    const maxEta = Math.max(0, ...solution.routes.flatMap((r) => r.stops.map((s) => s.eta_min)), 1);
    setPlayMin(0);
    const durationMs = BASE_PLAY_MS / playSpeed;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(maxEta, Math.floor(((now - start) / durationMs) * maxEta));
      setPlayMin(t);
      if (t < maxEta) raf = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, solution, playSpeed]);

  const runCompare = useCallback(async () => {
    setSolving("compare");
    setError(null);
    setPlaying(false);
    try {
      const result = await compare(scenarioId);
      setBaselines((prev) => ({ ...prev, [scenarioId]: result.baseline.metrics }));
      setSolution(result.optimize);
      setComparisonRows(result.comparison ?? []);
      setTravelPair(result.travel_source ?? null);
      setDisclosure(result.data_disclosure ?? "");
      setComparedOnce(true);
      setMapTimeline("after");
      if (result.optimize.weather) setWeather(result.optimize.weather);
      setBriefing([
        isLab ? "Compared Baseline vs Nexus on this synthetic day." : "Compared Baseline vs Nexus on the same day.",
        ...(result.improvements?.slice(0, 3) ?? []),
        `Late Δ ${result.deltas.late_count} · Distance Δ ${result.deltas.distance_km} km.`,
        result.optimize.feasible
          ? "Nexus plan is feasible under hard capacity + time windows."
          : "Nexus plan is NOT fully feasible — some stops deferred to protect hard constraints.",
        result.optimize.partial
          ? `Partial: ${result.optimize.unassigned.length} stops deferred (honest infeasibility under constraints).`
          : "All stops assigned without breaking hard constraints.",
      ]);
      await reloadHistory(scenarioId);
      const highRisk = result.optimize.routes.reduce(
        (n, r) => n + r.stops.filter((s) => (s.risk?.p_late ?? 0) >= 0.55).length,
        0,
      );
      persistLabCompareSession({
        scenarioId,
        orders: scenario?.orders.length ?? result.optimize.routes.reduce((n, r) => n + r.stops.length, 0),
        vehicles: scenario?.vehicles.length ?? result.optimize.routes.length,
        critical: scenario?.orders.filter((o) => o.priority === "critical").length ?? 0,
        totalDemand: scenario?.orders.reduce((n, o) => n + o.demand, 0) ?? 0,
        generationId: labGenerationId,
        baseline: {
          distance_km: result.baseline.metrics.distance_km,
          late_count: result.baseline.metrics.late_count,
          hard_breaches: result.baseline.metrics.hard_breaches,
          unassigned_count: result.baseline.metrics.unassigned_count,
        },
        optimize: {
          distance_km: result.optimize.metrics.distance_km,
          late_count: result.optimize.metrics.late_count,
          hard_breaches: result.optimize.metrics.hard_breaches,
          unassigned_count: result.optimize.metrics.unassigned_count,
          feasible: result.optimize.feasible,
          partial: result.optimize.partial,
          criticals_served: result.optimize.metrics.criticals_served,
          time_min: result.optimize.metrics.time_min,
        },
        highRiskCount: highRisk,
        travelSource: result.optimize.travel_source,
      });
      const riskId = pickHighestRiskOrderId(result.optimize);
      if (riskId) setSelectedId(riskId);
      setToast(
        result.optimize.feasible && !result.optimize.partial
          ? "Optimization complete — feasible Nexus plan. Highest-risk stop opened."
          : "Optimization complete — partial / constrained (honest). Highest-risk stop opened if any.",
      );
      setShowHelp(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Compare failed");
    } finally {
      setSolving(null);
    }
  }, [scenarioId, isLab, reloadHistory, scenario, labGenerationId]);

  const simulateBreakdown = useCallback(async () => {
    if (!scenario || !solution || !breakdownVehicle) return;
    setSolving("breakdown");
    setError(null);
    setPlaying(false);
    try {
      const before = solution;
      setPreDisruption(structuredClone(before));
      const affected =
        before.routes.find((r) => r.vehicle_id === breakdownVehicle)?.stops.length ?? 0;
      const result = await runLabOptimize({
        scenario_id: scenarioId,
        orders: scenario.orders.map((o) => ({
          order_id: o.order_id,
          lat: o.lat,
          lon: o.lon,
          demand: o.demand,
          tw_start: o.tw_start,
          tw_end: o.tw_end,
          service_min: o.service_min,
          priority: o.priority,
          zone: o.zone,
          customer: o.customer,
          address: o.address,
        })),
        vehicles: scenario.vehicles.map((v) => ({
          vehicle_id: v.vehicle_id,
          capacity: v.capacity,
          depot_lat: v.depot_lat,
          depot_lon: v.depot_lon,
          shift_start: v.shift_start,
          shift_end: v.shift_end,
          driver: v.driver,
          plate: v.plate,
        })),
        exclude_vehicle_ids: [breakdownVehicle],
        depot_lat: scenario.depot[0],
        depot_lon: scenario.depot[1],
      });
      setUnavailableVehicleIds(result.excluded_vehicles?.length ? result.excluded_vehicles : [breakdownVehicle]);
      setSolution(result.optimize);
      setMapTimeline("after");
      setComparisonRows(
        (result.comparison ?? []).map((row) => ({
          ...row,
          better_when: row.better_when ?? "lower",
        })),
      );
      setTravelPair(result.travel_source ?? null);
      setDisclosure(result.data_disclosure ?? "");
      setBaselines((prev) => ({ ...prev, [scenarioId]: result.baseline.metrics }));
      setFocusVehicle(null);
      setBriefing([
        `⚠ Vehicle ${breakdownVehicle} UNAVAILABLE — ${affected} stops on its prior route.`,
        "Reoptimized with remaining fleet via real OR-Tools (exclude_vehicle_ids).",
        result.optimize.partial
          ? `After: partial plan — ${result.optimize.unassigned.length} deferred.`
          : result.optimize.feasible
            ? "After: feasible plan under hard constraints."
            : "After: constrained result shown honestly.",
        `Late ${before.metrics.late_count} → ${result.optimize.metrics.late_count} · km ${before.metrics.distance_km.toFixed(1)} → ${result.optimize.metrics.distance_km.toFixed(1)}.`,
      ]);
      writeLabSession({
        disruption: {
          vehicle_id: breakdownVehicle,
          affected_orders: affected,
          before_late: before.metrics.late_count,
          after_late: result.optimize.metrics.late_count,
          before_distance_km: Number(before.metrics.distance_km.toFixed(1)),
          after_distance_km: Number(result.optimize.metrics.distance_km.toFixed(1)),
          updatedAt: new Date().toISOString(),
        },
      });
      const highRisk = result.optimize.routes.reduce(
        (n, r) => n + r.stops.filter((s) => (s.risk?.p_late ?? 0) >= 0.55).length,
        0,
      );
      persistLabCompareSession({
        scenarioId,
        orders: scenario.orders.length,
        vehicles: scenario.vehicles.length,
        critical: scenario.orders.filter((o) => o.priority === "critical").length,
        totalDemand: scenario.orders.reduce((n, o) => n + o.demand, 0),
        generationId: labGenerationId,
        baseline: {
          distance_km: before.metrics.distance_km,
          late_count: before.metrics.late_count,
          hard_breaches: before.metrics.hard_breaches,
          unassigned_count: before.metrics.unassigned_count,
        },
        optimize: {
          distance_km: result.optimize.metrics.distance_km,
          late_count: result.optimize.metrics.late_count,
          hard_breaches: result.optimize.metrics.hard_breaches,
          unassigned_count: result.optimize.metrics.unassigned_count,
          feasible: result.optimize.feasible,
          partial: result.optimize.partial,
          criticals_served: result.optimize.metrics.criticals_served,
          time_min: result.optimize.metrics.time_min,
        },
        highRiskCount: highRisk,
        travelSource: result.optimize.travel_source,
      });
      setToast(`Breakdown simulated — ${breakdownVehicle} excluded; new plan from solver.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Breakdown reoptimization failed");
      setPreDisruption(null);
      setUnavailableVehicleIds([]);
    } finally {
      setSolving(null);
    }
  }, [scenario, solution, breakdownVehicle, scenarioId, labGenerationId]);

  const clearDisruption = useCallback(() => {
    setUnavailableVehicleIds([]);
    setBreakdownVehicle(null);
    setPreDisruption(null);
    setMapTimeline("after");
    setToast("Disruption markers cleared — current plan unchanged.");
  }, []);

  const injectRushOrder = useCallback(async () => {
    if (!scenario) return;
    setSolving("rush");
    setError(null);
    setPlaying(false);
    try {
      const before = solution;
      // Fit rush window inside fleet shifts so OR-Tools does not fault.
      const shiftStart = Math.min(...scenario.vehicles.map((v) => v.shift_start));
      const shiftEnd = Math.max(...scenario.vehicles.map((v) => v.shift_end));
      const twStart = Math.max(shiftStart, 9 * 60);
      const twEnd = Math.min(shiftEnd, Math.max(twStart + 120, twStart + 60));
      const rushId = `RUSH-${Date.now().toString(36).slice(-5).toUpperCase()}`;
      const rush: Order = {
        order_id: rushId,
        lat: Number((scenario.depot[0] + 0.0075).toFixed(6)),
        lon: Number((scenario.depot[1] + 0.0055).toFixed(6)),
        demand: 3,
        tw_start: twStart,
        tw_end: twEnd,
        service_min: 10,
        priority: "critical",
        zone: "CENTRAL",
        zone_name: "MG Road",
        customer: "Rush Desk",
        address: "Priority pickup near Nexus Hub, Bengaluru",
        pincode: "560001",
        phone: "",
        sku: "RUSH",
        cod_inr: 0,
      };
      const nextOrders = [...scenario.orders, rush];
      const result = await runLabOptimize({
        scenario_id: scenarioId,
        orders: nextOrders.map((o) => ({
          order_id: o.order_id,
          lat: o.lat,
          lon: o.lon,
          demand: o.demand,
          tw_start: o.tw_start,
          tw_end: o.tw_end,
          service_min: o.service_min,
          priority: o.priority,
          zone: o.zone,
          customer: o.customer,
          address: o.address,
        })),
        vehicles: scenario.vehicles.map((v) => ({
          vehicle_id: v.vehicle_id,
          capacity: v.capacity,
          depot_lat: v.depot_lat,
          depot_lon: v.depot_lon,
          shift_start: v.shift_start,
          shift_end: v.shift_end,
          driver: v.driver,
          plate: v.plate,
        })),
        exclude_vehicle_ids: unavailableVehicleIds,
        depot_lat: scenario.depot[0],
        depot_lon: scenario.depot[1],
      });
      // Do not set preDisruption here — Before/After is for vehicle breakdown only.
      setScenario({ ...scenario, orders: nextOrders });
      setRushOrderId(rushId);
      setSolution(result.optimize);
      setBaselines((prev) => ({ ...prev, [scenarioId]: result.baseline.metrics }));
      setComparisonRows(
        (result.comparison ?? []).map((row) => ({
          ...row,
          better_when: row.better_when ?? "lower",
        })),
      );
      setTravelPair(result.travel_source ?? null);
      setDisclosure(result.data_disclosure ?? "");
      setComparedOnce(true);
      setMapTimeline("after");
      setSelectedId(rushId);
      setBriefing([
        `Rush order ${rushId} injected (critical · tight window).`,
        "Re-solved with real OR-Tools + ML risk on the updated order set.",
        result.optimize.partial
          ? `Partial after rush — ${result.optimize.unassigned.length} deferred under hard constraints.`
          : result.optimize.feasible
            ? "Feasible plan after rush insert."
            : "Constrained result shown honestly.",
        before
          ? `Late ${before.metrics.late_count} → ${result.optimize.metrics.late_count} · km ${before.metrics.distance_km.toFixed(1)} → ${result.optimize.metrics.distance_km.toFixed(1)}.`
          : `Late ${result.optimize.metrics.late_count} · ${result.optimize.metrics.distance_km.toFixed(1)} km.`,
      ]);
      setToast(`Rush ${rushId} inserted — plan reoptimized.`);
      setShowHelp(false);
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Rush inject failed";
      const friendly =
        /cp solver fail/i.test(raw)
          ? "Optimizer could not place the rush stop under hard windows/capacity — try again or load a fresh scenario."
          : raw;
      setError(friendly);
    } finally {
      setSolving(null);
    }
  }, [scenario, solution, scenarioId, unavailableVehicleIds]);

  const onHold = useCallback(
    async (nextHeld: boolean) => {
      if (!selectedId) return;
      try {
        const res = await setHold(scenarioId, selectedId, nextHeld);
        setHeld(res.held);
        await reloadScenario(scenarioId);
        if (solution) await run(solution.mode);
        setToast(nextHeld ? `Held ${selectedId} for a later wave` : `Released ${selectedId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Hold failed");
      }
    },
    [selectedId, scenarioId, reloadScenario, solution, run],
  );

  const onClearHolds = useCallback(async () => {
    try {
      const res = await clearHolds(scenarioId);
      setHeld(res.held);
      await reloadScenario(scenarioId);
      if (solution) await run(solution.mode);
      setToast("All holds cleared");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clear holds failed");
    }
  }, [scenarioId, reloadScenario, solution, run]);

  const onWeather = useCallback(async () => {
    try {
      const w = await refreshWeather();
      setWeather(w);
      setToast(`Weather updated: ${w.label}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Weather refresh failed");
    }
  }, []);

  const selected = useMemo(() => {
    if (!selectedId || !scenario) {
      return {
        stop: null as Stop | null,
        order: null,
        vehicleId: null as string | null,
        route: null as RoutePlan | null,
      };
    }
    const order = scenario.orders.find((o) => o.order_id === selectedId) ?? null;
    const unassigned = solution?.unassigned.find((u) => u.order_id === selectedId) ?? null;
    let stop: Stop | null = null;
    let vehicleId: string | null = null;
    let route: RoutePlan | null = null;
    if (solution) {
      for (const r of solution.routes) {
        const found = r.stops.find((s) => s.order_id === selectedId);
        if (found) {
          stop = found;
          vehicleId = r.vehicle_id;
          route = r;
          break;
        }
      }
    }
    return { stop, order: order ?? unassigned, vehicleId, route };
  }, [selectedId, scenario, solution]);

  const idleRoutes = useMemo(() => {
    if (solution) {
      const routes = [...solution.routes];
      // Keep broken vans visible in the rail with empty stops.
      for (const vid of unavailableVehicleIds) {
        if (routes.some((r) => r.vehicle_id === vid)) continue;
        const v = scenario?.vehicles.find((x) => x.vehicle_id === vid);
        const prior = preDisruption?.routes.find((r) => r.vehicle_id === vid);
        routes.push({
          vehicle_id: vid,
          load: 0,
          capacity: v?.capacity ?? prior?.capacity ?? 0,
          polyline: [],
          stops: [],
          shift_start: v?.shift_start ?? prior?.shift_start ?? 0,
          shift_end: v?.shift_end ?? prior?.shift_end ?? 0,
          capacity_breach: false,
          driver: v?.driver ?? prior?.driver ?? "",
          plate: v?.plate ?? prior?.plate ?? "",
          phone: v?.phone ?? prior?.phone ?? "",
          rating: v?.rating ?? prior?.rating ?? 0,
          road_source: "unavailable",
        });
      }
      return routes;
    }
    if (!scenario) return [];
    return scenario.vehicles.map((v) => ({
      vehicle_id: v.vehicle_id,
      load: 0,
      capacity: v.capacity,
      polyline: [] as number[][],
      stops: [] as Stop[],
      shift_start: v.shift_start,
      shift_end: v.shift_end,
      capacity_breach: false,
      driver: v.driver,
      plate: v.plate,
      phone: v.phone,
      rating: v.rating,
      road_source: "pending",
    }));
  }, [solution, scenario, unavailableVehicleIds, preDisruption]);

  const baseline = baselines[scenarioId] ?? null;
  const showDeltas = Boolean(solution && solution.mode === "optimize" && baseline);
  const busy = solving != null;
  const clockLabel = clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const weatherLabel = weather?.ok ? `${weather.label} · ${weather.temp_c ?? "—"}°C` : "Weather loading…";
  const mode = solution?.mode ?? "optimize";
  const orderCount = scenario?.orders.length ?? 0;
  const vanCount = scenario?.vehicles.length ?? 0;
  const criticalCount = scenario?.orders.filter((o) => o.priority === "critical").length ?? 0;
  const highRiskCount =
    solution?.routes.reduce(
      (n, r) => n + r.stops.filter((s) => (s.risk?.p_late ?? 0) >= 0.55).length,
      0,
    ) ?? 0;
  const mapShowCompare = Boolean(preDisruption && unavailableVehicleIds.length > 0);
  const mapSolution =
    mapShowCompare && mapTimeline === "before" && preDisruption ? preDisruption : solution;
  const mapUnavailableIds = mapTimeline === "before" && mapShowCompare ? [] : unavailableVehicleIds;
  const jp019Items = [
    {
      id: "route",
      label: "Optimized last-mile routing under real constraints",
      done: Boolean(solution && comparedOnce),
      detail: solution ? `mode ${solution.mode} · travel ${solution.travel_source}` : "Run Optimize",
    },
    {
      id: "risk",
      label: "Late-delivery risk surfaced on the plan",
      done: highRiskCount > 0 || Boolean(selectedId && solution),
      detail: highRiskCount > 0 ? `${highRiskCount} stops with p_late ≥ 0.55` : "Open Why This Route after Optimize",
    },
    {
      id: "exception",
      label: "Exception path (breakdown / rush / defer)",
      done: Boolean(unavailableVehicleIds.length || rushOrderId || solution?.partial),
      detail: unavailableVehicleIds[0]
        ? `Van ${unavailableVehicleIds[0]} excluded`
        : rushOrderId
          ? `Rush ${rushOrderId}`
          : solution?.partial
            ? `${solution.unassigned.length} deferred`
            : "Simulate breakdown or inject rush",
    },
    {
      id: "honest",
      label: "Honest feasibility — no fabricated full success",
      done: Boolean(solution),
      detail: solution
        ? solution.feasible && !solution.partial
          ? "Feasible under hard constraints"
          : "Partial / constrained shown honestly"
        : undefined,
    },
    {
      id: "measured",
      label: "Measured Baseline vs Nexus on this run",
      done: Boolean(baseline && solution && showDeltas),
      detail: baseline && solution ? `Late ${baseline.late_count} → ${solution.metrics.late_count}` : undefined,
    },
  ];

  const btn =
    "inline-flex min-h-11 items-center gap-2 border border-hairline bg-snow px-3 py-2 font-sans text-[13px] font-semibold text-ink transition hover:border-ink disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";


  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink">
      <LoadingOverlay mode={solving} stageIndex={stage} />
      <WinSheetPanel scenarioId={scenarioId} open={winOpen} onClose={() => setWinOpen(false)} />
      {exportKind && (
        <ExportViewer kind={exportKind} scenarioId={scenarioId} mode={mode} onClose={() => setExportKind(null)} />
      )}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[1100] max-w-sm border border-ink bg-snow px-4 py-3 font-sans text-[14px] text-ink shadow-card">
          {toast}
        </div>
      )}

      {/* Sticky command bar — stay here; map is below */}
      <div className="sticky top-0 z-[800] border-b border-hairline bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-3 py-2 sm:px-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="flex h-9 w-9 shrink-0 items-center justify-center"
              aria-label="Back to presentation"
            >
              <BrandLogo className="h-8 w-8" />
            </button>
            <p className="hidden font-sans text-[14px] font-semibold sm:block">Optimizer Lab</p>

            <div className="flex overflow-hidden border border-hairline" role="group" aria-label="Scenario day">
              <button
                type="button"
                onClick={() => setScenarioId("a")}
                className={`min-h-9 px-3 font-sans text-[12px] font-semibold ${
                  scenarioId === "a" ? "bg-ink text-snow" : "bg-snow text-mute hover:text-ink"
                }`}
              >
                Day A
              </button>
              <button
                type="button"
                onClick={() => setScenarioId("b")}
                className={`min-h-9 px-3 font-sans text-[12px] font-semibold ${
                  scenarioId === "b" ? "bg-coral text-ink" : "bg-snow text-mute hover:text-ink"
                }`}
              >
                Day B
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void loadNewSynthetic()}
                className={`inline-flex min-h-9 items-center gap-1 border-l border-hairline px-3 font-sans text-[12px] font-semibold disabled:opacity-40 ${
                  isLab ? "bg-coral text-ink" : "bg-snow text-mute hover:text-ink"
                }`}
              >
                <Sparkles size={14} />
                {solving === "synthetic" ? "…" : "Load"}
              </button>
            </div>

            <div className="hidden items-center gap-1 md:flex">
              {ARCHETYPE_OPTIONS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  disabled={busy}
                  title={a.hint}
                  onClick={() => void loadNewSynthetic(a.id)}
                  className={`min-h-8 border px-2 font-sans text-[11px] font-semibold ${
                    archetype === a.id ? "border-ink bg-snow text-ink" : "border-transparent text-mute hover:text-ink"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={busy || scenarioLoading || !scenario}
              onClick={() => void runCompare()}
              className={`inline-flex min-h-9 items-center gap-2 bg-coral px-4 font-sans text-[13px] font-semibold text-ink disabled:opacity-40 ${
                solving === "compare" ? "solving-glow" : ""
              }`}
            >
              {solving === "compare" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Optimize
            </button>

            <button
              type="button"
              disabled={busy || !solution}
              onClick={() => setPlaying(true)}
              className={btn.replace("min-h-11", "min-h-9")}
            >
              <Play size={14} /> Play{playMin != null ? ` ${fmtClock(playMin)}` : ""}
            </button>
            <div className="flex overflow-hidden border border-hairline" role="group" aria-label="Play speed">
              {PLAY_SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy || !solution}
                  onClick={() => {
                    setPlaySpeed(s);
                    if (playing) {
                      setPlaying(false);
                      window.requestAnimationFrame(() => setPlaying(true));
                    }
                  }}
                  className={`min-h-9 px-2 font-mono text-[11px] font-semibold ${
                    playSpeed === s ? "bg-ink text-snow" : "bg-snow text-mute hover:text-ink"
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={busy || !scenario}
              onClick={() => void injectRushOrder()}
              className={btn.replace("min-h-11", "min-h-9")}
              title="Inject critical rush + re-solve"
            >
              <Zap size={14} /> Rush
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => setWinOpen(true)}
              className={btn.replace("min-h-11", "min-h-9")}
            >
              <FileText size={14} /> Win
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                className={btn.replace("min-h-11", "min-h-9")}
              >
                More
              </button>
              {moreOpen && (
                <div className="absolute right-0 top-full z-[900] mt-1 min-w-[200px] border border-ink bg-snow py-1 shadow-card">
                  <button type="button" className="block w-full px-3 py-2 text-left font-sans text-[13px] hover:bg-paper" disabled={busy} onClick={() => { setMoreOpen(false); void onWeather(); }}>
                    <Cloud size={14} className="mr-2 inline" /> Weather
                  </button>
                  <button type="button" className="block w-full px-3 py-2 text-left font-sans text-[13px] hover:bg-paper" disabled={busy} onClick={() => { setMoreOpen(false); setExportKind("csv"); }}>
                    <Download size={14} className="mr-2 inline" /> Driver sheet
                  </button>
                  <button type="button" className="block w-full px-3 py-2 text-left font-sans text-[13px] hover:bg-paper" disabled={busy} onClick={() => { setMoreOpen(false); setExportKind("geojson"); }}>
                    <MapIcon size={14} className="mr-2 inline" /> Map export
                  </button>
                  <button type="button" className="block w-full px-3 py-2 text-left font-sans text-[13px] hover:bg-paper" disabled={busy} onClick={() => { setMoreOpen(false); void run("baseline"); }}>
                    Naive plan
                  </button>
                  <button type="button" className="block w-full px-3 py-2 text-left font-sans text-[13px] hover:bg-paper" disabled={busy} onClick={() => { setMoreOpen(false); void run("optimize"); }}>
                    Nexus only
                  </button>
                  {held.length > 0 && (
                    <button type="button" className="block w-full px-3 py-2 text-left font-sans text-[13px] text-coral hover:bg-paper" onClick={() => { setMoreOpen(false); void onClearHolds(); }}>
                      Clear {held.length} holds
                    </button>
                  )}
                  <button type="button" className="block w-full px-3 py-2 text-left font-sans text-[13px] hover:bg-paper" onClick={() => { setMoreOpen(false); setShowHelp((v) => !v); }}>
                    <HelpCircle size={14} className="mr-2 inline" /> {showHelp ? "Hide help" : "Help"}
                  </button>
                </div>
              )}
            </div>

            <p className="ml-auto hidden font-mono text-[11px] text-mute lg:block">
              {scenarioLoading ? "Loading…" : `${orderCount} stops · ${vanCount} vans · ${criticalCount} crit`}
              {solution ? ` · ${solution.feasible && !solution.partial ? "feasible" : "partial"} · risk ${highRiskCount}` : ""}
              {" · "}
              {weatherLabel} · {clockLabel}
            </p>
          </div>

          {error && (
            <div className="flex items-center justify-between border border-coral bg-snow px-3 py-2 font-sans text-[13px] text-coral">
              <span>{error}</span>
              <button type="button" className="underline" onClick={() => setError(null)}>
                Dismiss
              </button>
            </div>
          )}

          {showHelp && (
            <div className="relative border border-hairline bg-snow px-3 py-2 font-sans text-[13px] text-mute">
              <button type="button" className="absolute right-2 top-2" onClick={() => setShowHelp(false)} aria-label="Close help">
                <X size={14} />
              </button>
              Load → Optimize → click risk stop → optional van breakdown in the right rail. Metrics live under Details.
            </div>
          )}
        </div>
      </div>

      {/* Map-first workspace */}
      <div className="mx-auto grid w-full max-w-[1600px] flex-1 gap-3 px-3 py-3 sm:px-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.85fr)]">
        <div className="relative min-h-[min(70vh,720px)] overflow-hidden lg:min-h-[calc(100dvh-7.5rem)]">
          {!solution && !busy && (
            <div className="pointer-events-none absolute inset-x-4 top-14 z-10 border border-ink/20 bg-snow/95 p-3 font-sans text-[13px] text-mute">
              Map shows today’s stops. Run Optimize for routes. Click a stop for Why This Route.
            </div>
          )}
          {unavailableVehicleIds[0] && (
            <p className="pointer-events-none absolute left-3 top-3 z-[600] border border-coral bg-[#FFF5F2] px-3 py-1.5 font-sans text-[12px] font-semibold text-ink">
              ⚠ Vehicle {unavailableVehicleIds[0]} UNAVAILABLE
              {mapTimeline === "before" ? " · viewing BEFORE plan" : " · viewing AFTER replan"}
            </p>
          )}
          {mapShowCompare && (
            <div className="absolute right-3 top-3 z-[600] flex flex-col items-end gap-1">
              <div className="flex overflow-hidden border border-ink bg-snow shadow-card">
                <button
                  type="button"
                  onClick={() => setMapTimeline("before")}
                  className={`px-3 py-1.5 font-sans text-[12px] font-semibold ${
                    mapTimeline === "before" ? "bg-ink text-snow" : "text-mute hover:text-ink"
                  }`}
                >
                  Before
                </button>
                <button
                  type="button"
                  onClick={() => setMapTimeline("after")}
                  className={`px-3 py-1.5 font-sans text-[12px] font-semibold ${
                    mapTimeline === "after" ? "bg-ink text-snow" : "text-mute hover:text-ink"
                  }`}
                >
                  After
                </button>
              </div>
              {preDisruption && solution && (
                <p className="border border-hairline bg-snow/95 px-2 py-1 font-mono text-[10px] text-mute">
                  late {preDisruption.metrics.late_count}→{solution.metrics.late_count} · km{" "}
                  {preDisruption.metrics.distance_km.toFixed(1)}→{solution.metrics.distance_km.toFixed(1)}
                </p>
              )}
            </div>
          )}
          <CityMap
            scenario={scenario}
            solution={mapSolution}
            selectedId={selectedId}
            focusVehicle={focusVehicle}
            hoverVehicle={hoverVehicle}
            playMin={playMin}
            unavailableVehicleIds={mapUnavailableIds}
            onSelect={setSelectedId}
            onFocusVehicle={setFocusVehicle}
          />
          {selectedId && (
            <WhyThisRoute
              stop={selected.stop}
              order={selected.order}
              vehicleId={selected.vehicleId}
              route={selected.route}
              constraintLog={solution?.constraint_log ?? []}
              held={held.includes(selectedId)}
              onClose={() => setSelectedId(null)}
              onHold={(h) => void onHold(h)}
            />
          )}
        </div>

        <div className="flex max-h-[min(70vh,720px)] flex-col gap-3 overflow-y-auto pr-1 lg:max-h-[calc(100dvh-7.5rem)]">
          <p className="font-sans text-[12px] font-semibold uppercase tracking-wide text-mute">
            Vans & drivers{focusVehicle ? ` · ${focusVehicle}` : ""}
          </p>
          <VehicleRail
            routes={idleRoutes}
            hoverVehicle={hoverVehicle}
            focusVehicle={focusVehicle}
            unavailableVehicleIds={unavailableVehicleIds}
            onHover={setHoverVehicle}
            onFocus={setFocusVehicle}
            onSelectStop={setSelectedId}
            selectedId={selectedId}
          />
          {solution && scenario && (
            <DisruptionPanel
              vehicleIds={scenario.vehicles.map((v) => v.vehicle_id)}
              selectedVehicle={breakdownVehicle}
              unavailableVehicleIds={unavailableVehicleIds}
              busy={busy}
              hasPlan={Boolean(solution)}
              beforeMetrics={preDisruption?.metrics ?? null}
              afterMetrics={unavailableVehicleIds.length ? solution.metrics : null}
              onSelectVehicle={(id) => {
                setBreakdownVehicle(id);
                if (id) setFocusVehicle(id);
              }}
              onSimulate={() => void simulateBreakdown()}
              onClear={clearDisruption}
            />
          )}
          <DeferredList
            items={solution?.unassigned ?? []}
            reasons={solution?.constraint_log ?? []}
            onSelect={setSelectedId}
          />
          <ConstraintLog items={solution?.constraint_log ?? []} />
        </div>
      </div>

      {/* Collapsed details — optional scroll */}
      <div className="mx-auto w-full max-w-[1600px] px-3 pb-6 sm:px-4">
        <button
          type="button"
          onClick={() => setDetailsOpen((v) => !v)}
          className="flex w-full items-center justify-between border border-hairline bg-snow px-4 py-3 font-sans text-[13px] font-semibold"
        >
          <span>
            Details
            {solution
              ? ` · late ${solution.metrics.late_count} · ${solution.metrics.distance_km.toFixed(1)} km · travel ${solution.travel_source}`
              : " · metrics, compare, orders, checklist"}
          </span>
          <span className="font-mono text-[11px] text-mute">{detailsOpen ? "Hide" : "Show"}</span>
        </button>

        {detailsOpen && (
          <div className="mt-3 flex flex-col gap-3">
            {solution && (
              <div
                className={`border px-4 py-3 font-sans text-[14px] ${
                  solution.feasible && !solution.partial ? "border-hairline bg-snow" : "border-coral bg-snow"
                }`}
              >
                <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-mute">Plan status</p>
                <p className="mt-1 font-semibold">
                  {solution.feasible && !solution.partial
                    ? "Feasible — hard capacity and time windows satisfied."
                    : solution.partial
                      ? `Partial — ${solution.unassigned.length} deferred. Not marked fully optimized.`
                      : "Infeasible under hard constraints — shown honestly."}
                </p>
              </div>
            )}
            <Scoreboard metrics={solution?.metrics ?? null} baseline={baseline} showDeltas={showDeltas} loading={busy} />
            {showDeltas && baseline && solution && (
              <MeasuredImprovement
                baseline={baseline}
                nexus={solution.metrics}
                feasible={solution.feasible}
                partial={solution.partial}
                synthetic={isLab}
              />
            )}
            {comparisonRows.length > 0 && (
              <ComparisonTable
                rows={comparisonRows}
                travelBaseline={travelPair?.baseline}
                travelOptimized={travelPair?.optimize}
              />
            )}
            {solution && (
              <ExceptionStory
                partial={solution.partial}
                unassigned={solution.unassigned}
                log={solution.constraint_log}
                metrics={solution.metrics}
                heldCount={held.length}
              />
            )}
            {briefing.length > 0 && (
              <div className="border border-hairline bg-snow px-4 py-3">
                <p className="font-sans text-[12px] font-semibold uppercase tracking-wide text-mute">What just happened</p>
                <ul className="mt-2 space-y-1 font-sans text-[14px] text-mute">
                  {briefing.map((line) => (
                    <li key={line}>· {line}</li>
                  ))}
                </ul>
              </div>
            )}
            {disclosure && (
              <p className="font-sans text-[12px] text-mute">
                Data note: <span className="text-ink">{disclosure}</span>
              </p>
            )}
            {scenario && (
              <OrderBoard orders={scenario.orders} solution={solution} selectedId={selectedId} onSelect={setSelectedId} />
            )}
            <HistoryPanel items={history} />
            <Jp019Checklist items={jp019Items} />
            <p className="font-sans text-[12px] text-mute">
              Shortcuts: 1/2 Day A/B · 3 Load · B naive · O Nexus · Esc closes panels
              {cacheMode ? ` · cache ${cacheMode}` : ""}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
