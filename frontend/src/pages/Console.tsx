import { useCallback, useEffect, useMemo, useState } from "react";
import { Cloud, Download, FileText, HelpCircle, Loader2, Map as MapIcon, Play, Sparkles, X } from "lucide-react";
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
import { GuideBanner } from "../components/GuideBanner";
import { HistoryPanel } from "../components/HistoryPanel";
import { LoadingOverlay } from "../components/LoadingOverlay";
import { OrderBoard } from "../components/OrderBoard";
import { WhyThisRoute } from "../components/WhyThisRoute";
import { Scoreboard } from "../components/Scoreboard";
import { BrandLogo } from "../components/BrandLogo";
import { VehicleRail } from "../components/VehicleRail";
import { WinSheetPanel } from "../components/WinSheetPanel";
import { fmtClock } from "../lib/format";
import { loadSyntheticScenario, runLabOptimize } from "../lib/labApi";
import { persistLabCompareSession, writeLabSession } from "../lib/labSession";
import type { Metrics, RoutePlan, ScenarioDetail, Solution, SolveMode, Stop, Weather } from "../types";

interface ConsoleProps {
  onBack: () => void;
}

type BusyMode = SolveMode | "compare" | "synthetic" | "breakdown" | null;
/** Day packs a/b plus live synthetic pack persisted as SQLite id `lab`. */
type DayId = "a" | "b" | "lab";

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
  const [showHelp, setShowHelp] = useState(true);
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
  const [exportKind, setExportKind] = useState<ExportKind | null>(null);
  const [clock, setClock] = useState(() => new Date());
  const [comparisonRows, setComparisonRows] = useState<ComparisonRow[]>([]);
  const [travelPair, setTravelPair] = useState<{ baseline: string; optimize: string } | null>(null);
  const [winOpen, setWinOpen] = useState(false);
  const [disclosure, setDisclosure] = useState<string>("");

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

  const loadNewSynthetic = useCallback(async () => {
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
    try {
      const payload = await loadSyntheticScenario();
      setLabGenerationId(payload.generation_id ?? `lab-${payload.seed.toString(16)}`);
      setScenarioId("lab");
      await reloadScenario("lab");
      await reloadHistory("lab");
      setBriefing([
        "SYNTHETIC DEMO SCENARIO — fresh Bengaluru day (new every Load).",
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
        `Scenario loaded · ${payload.summary.orders} orders · ${payload.summary.vehicles} vans · ${payload.summary.critical} critical`,
      );
      setShowHelp(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Synthetic load failed");
    } finally {
      setScenarioLoading(false);
      setSolving(null);
    }
  }, [reloadScenario, reloadHistory]);

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
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(maxEta, Math.floor(((now - start) / 12000) * maxEta));
      setPlayMin(t);
      if (t < maxEta) raf = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, solution]);

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
      setToast(
        result.optimize.feasible && !result.optimize.partial
          ? "Optimization complete — feasible Nexus plan."
          : "Optimization complete — partial / constrained result (shown honestly).",
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
      setPreDisruption(before);
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
    setToast("Disruption markers cleared — current plan unchanged.");
  }, []);

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

  const btn =
    "inline-flex min-h-11 items-center gap-2 border border-hairline bg-snow px-3 py-2 font-sans text-[13px] font-semibold text-ink transition hover:border-ink disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

  return (
    <div className="min-h-dvh bg-paper px-4 py-5 text-ink sm:px-6">
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

      <div className="mx-auto flex max-w-[1440px] flex-col gap-4">
        {/* Purpose strip */}
        <div className="flex flex-wrap items-start justify-between gap-3 border border-hairline bg-snow px-4 py-3">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={onBack}
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center"
              aria-label="Back to presentation"
              title="Back to presentation"
            >
              <BrandLogo className="h-9 w-9" />
            </button>
            <div>
              <p className="font-sans text-[15px] font-semibold">Nexus Optimizer Lab</p>
              <p className="mt-0.5 max-w-[54ch] font-sans text-[13px] leading-snug text-mute">
                Load a fresh synthetic scenario, run real OR-Tools CVRPTW, compare Baseline vs Nexus. Hard capacity and
                time windows are never broken.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void loadNewSynthetic()}
              className="inline-flex min-h-11 items-center gap-2 border border-ink bg-snow px-4 py-2 font-sans text-[13px] font-semibold text-ink hover:bg-paper disabled:opacity-40"
              title="POST /api/lab/synthetic — new scenario every click"
            >
              <Sparkles size={15} />
              {solving === "synthetic" ? "Generating…" : "Load Scenario"}
            </button>
            <button
              type="button"
              disabled={busy || scenarioLoading || !scenario}
              onClick={() => void runCompare()}
              className={`inline-flex min-h-11 items-center gap-2 bg-coral px-5 py-2 font-sans text-[13px] font-semibold text-ink hover:brightness-95 disabled:opacity-40 ${
                solving === "compare" ? "solving-glow" : ""
              }`}
              title="POST /api/compare — real Baseline vs Nexus"
            >
              {solving === "compare" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Optimize
            </button>
            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              className="inline-flex min-h-10 items-center gap-2 border border-hairline px-3 py-2 font-sans text-[13px] font-semibold text-ink hover:border-ink"
            >
              <HelpCircle size={16} />
              {showHelp ? "Hide help" : "Show help"}
            </button>
          </div>
        </div>

        {showHelp && (
          <section className="relative border border-ink bg-snow px-5 py-4">
            <button
              type="button"
              className="absolute right-3 top-3 p-1 text-mute hover:text-ink"
              onClick={() => setShowHelp(false)}
              aria-label="Close help"
            >
              <X size={16} />
            </button>
            <h2 className="pr-8 font-sans text-[18px] font-semibold">How to use this screen</h2>
            <ol className="mt-3 grid gap-3 font-sans text-[14px] text-mute sm:grid-cols-3">
              <li>
                <span className="font-semibold text-ink">1. Load Scenario</span>
                <br />
                Fresh SYNTHETIC DEMO SCENARIO every click (or use Day A / Day B packs).
              </li>
              <li>
                <span className="font-semibold text-ink">2. Optimize</span>
                <br />
                Runs real Baseline + Nexus (OR-Tools). Metrics are never fabricated.
              </li>
              <li>
                <span className="font-semibold text-ink">3. Map & risk</span>
                <br />
                Click a van to focus its route. Critical = ◆ · High risk = ! from actual ML scores.
              </li>
            </ol>
            <p className="mt-3 font-sans text-[13px] text-mute">
              Tip: if the plan is partial, deferred stops stay deferred — we do not fake feasibility.
            </p>
          </section>
        )}

        {/* Scenario intelligence strip */}
        <div className="grid gap-3 border border-hairline bg-snow px-4 py-3 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-mute">
              {isLab ? "Synthetic demo scenario" : scenarioId === "b" ? "Day B · Overconstrained pack" : "Day A · Feasible pack"}
            </p>
            <p className="mt-1 font-sans text-[20px] font-semibold tabular text-ink">
              {scenarioLoading
                ? "Loading…"
                : `${orderCount} orders · ${vanCount} vehicles · ${criticalCount} critical`}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-mute">
              id <span className="text-ink">{scenarioId}</span>
              {labGenerationId ? ` · ${labGenerationId}` : ""}
              {solution
                ? ` · ${solution.feasible && !solution.partial ? "feasible" : "partial / constrained"} · high-risk stops ${highRiskCount}`
                : " · not optimized yet"}
            </p>
          </div>
          {isLab && (
            <p className="self-center border border-ink px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-wide text-ink">
              Synthetic demo scenario
            </p>
          )}
        </div>

        <header className="border border-hairline bg-snow">
          <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-3">
            <div>
              <p className="font-sans text-[12px] font-semibold uppercase tracking-wide text-mute">Which day?</p>
              <div className="mt-1 flex flex-wrap overflow-hidden border border-hairline" role="group" aria-label="Which day to plan">
                <button
                  type="button"
                  onClick={() => setScenarioId("a")}
                  title="Normal day: enough vans and time for every stop"
                  className={`min-h-11 px-4 font-sans text-[13px] font-semibold ${
                    scenarioId === "a" ? "bg-ink text-snow" : "bg-snow text-mute hover:text-ink"
                  }`}
                >
                  Day A · Normal
                </button>
                <button
                  type="button"
                  onClick={() => setScenarioId("b")}
                  title="Overloaded day: some stops must wait for the next wave"
                  className={`min-h-11 px-4 font-sans text-[13px] font-semibold ${
                    scenarioId === "b" ? "bg-coral text-ink" : "bg-snow text-mute hover:text-ink"
                  }`}
                >
                  Day B · Overloaded
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void loadNewSynthetic()}
                  title="Generate a NEW random Bengaluru scenario (different every click)"
                  className={`inline-flex min-h-11 items-center gap-1.5 border-l border-hairline px-4 font-sans text-[13px] font-semibold disabled:opacity-40 ${
                    isLab ? "bg-coral text-ink" : "bg-snow text-mute hover:text-ink"
                  }`}
                >
                  <Sparkles size={15} />
                  {solving === "synthetic" ? "Generating…" : isLab ? "Reload scenario" : "Load Scenario"}
                </button>
              </div>
              {isLab && labGenerationId && (
                <p className="mt-1.5 font-mono text-[11px] text-mute">
                  {labGenerationId} · each Load creates a new SYNTHETIC DEMO SCENARIO
                </p>
              )}
            </div>

            <div className="ml-auto text-right font-sans text-[12px] text-mute">
              <p className="text-ink">
                {scenarioLoading ? "Loading orders…" : `${orderCount} stops · ${vanCount} vans`}
              </p>
              <p>
                {weatherLabel} · {clockLabel}
                {cacheMode ? ` · cache ${cacheMode}` : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <p className="mr-2 hidden font-sans text-[12px] font-semibold uppercase tracking-wide text-mute lg:block">
              Actions
            </p>
            {held.length > 0 && (
              <button type="button" onClick={() => void onClearHolds()} className={`${btn} text-coral`} title="Put held stops back into planning">
                Clear {held.length} holds
              </button>
            )}
            <button type="button" disabled={busy} onClick={() => void onWeather()} className={btn} title="Refresh live Bengaluru weather">
              <Cloud size={15} /> Weather
            </button>
            <button
              type="button"
              disabled={busy || !solution}
              onClick={() => setPlaying(true)}
              className={btn}
              title="Animate deliveries in time order on the map"
            >
              <Play size={15} /> Play day{playMin != null ? ` ${fmtClock(playMin)}` : ""}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setExportKind("csv")}
              className={btn}
              title="Open a clean driver sheet you can download"
            >
              <Download size={15} /> Driver sheet
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setExportKind("geojson")}
              className={btn}
              title="Open map data preview for GIS tools"
            >
              <MapIcon size={15} /> Map export
            </button>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setWinOpen(true)}
                className={btn}
                title="Open judge-facing win sheet with measured results"
              >
                <FileText size={15} /> Win sheet
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run("baseline")}
                className={btn}
                title="Build a simple first-fit plan. This is the weak baseline."
              >
                Naive plan
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void runCompare()}
                className={btn}
                title="Run naive + smart together and show the difference"
              >
                {solving === "compare" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Baseline vs Nexus
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run("optimize")}
                title="Build the best plan that still respects capacity and time windows"
                className={`inline-flex min-h-11 items-center gap-2 bg-coral px-5 py-2 font-sans text-[13px] font-semibold text-ink transition hover:brightness-95 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                  solving === "optimize" ? "solving-glow" : ""
                }`}
              >
                {solving === "optimize" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Nexus only
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div className="flex items-center justify-between border border-coral bg-snow px-4 py-3 font-sans text-[14px] text-coral">
            <span>{error}</span>
            <button type="button" className="underline" onClick={() => setError(null)}>
              Dismiss
            </button>
          </div>
        )}

        <GuideBanner
          hasSolution={Boolean(solution)}
          scenarioId={scenarioId === "lab" ? "a" : scenarioId}
          onBaseline={() => void run("baseline")}
          onOptimize={() => void run("optimize")}
          onCompare={() => void runCompare()}
          busy={busy}
        />

        <Scoreboard
          metrics={solution?.metrics ?? null}
          baseline={baseline}
          showDeltas={showDeltas}
          loading={busy}
        />

        {solution && (
          <div
            className={`border px-4 py-3 font-sans text-[14px] ${
              solution.feasible && !solution.partial
                ? "border-hairline bg-snow text-ink"
                : "border-coral bg-snow text-ink"
            }`}
            role="status"
          >
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-mute">Plan status</p>
            <p className="mt-1 font-semibold">
              {solution.feasible && !solution.partial
                ? "Feasible Nexus plan — hard capacity and time windows satisfied."
                : solution.partial
                  ? `Partial plan — ${solution.unassigned.length} stops deferred. Not marked as fully optimized.`
                  : "Infeasible under hard constraints — shown honestly (no fabricated success)."}
            </p>
            <p className="mt-1 text-[13px] text-mute">
              mode {solution.mode} · travel {solution.travel_source} · ML high-risk stops (p≥0.55): {highRiskCount}
            </p>
          </div>
        )}

        {solution && (
          <p className="font-mono text-[12px] text-mute">
            Travel source:{" "}
            <span className="font-semibold text-ink">
              {solution.travel_source === "osrm"
                ? "OSRM"
                : solution.travel_source.includes("haversine")
                  ? "Haversine fallback"
                  : solution.travel_source}
            </span>
            {solution.mode === "baseline"
              ? " · BASELINE heuristic (may violate capacity)"
              : " · OPTIMIZED OR-Tools (hard capacity + windows)"}
          </p>
        )}

        {comparisonRows.length > 0 && (
          <ComparisonTable
            rows={comparisonRows}
            travelBaseline={travelPair?.baseline}
            travelOptimized={travelPair?.optimize}
          />
        )}

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

        {disclosure && (
          <p className="font-sans text-[12px] text-mute">
            Data note: <span className="text-ink">{disclosure}</span>
          </p>
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

        {(solution?.partial || briefing.length > 0) && (
          <div className="border border-hairline bg-snow px-4 py-3">
            <p className="font-sans text-[12px] font-semibold uppercase tracking-wide text-mute">What just happened</p>
            {solution?.partial && (
              <p className="mt-1 font-sans text-[18px] font-semibold text-ink">
                Partial plan: {solution.unassigned.length} stops deferred so rules stay intact.
              </p>
            )}
            <ul className="mt-2 space-y-1 font-sans text-[14px] text-mute">
              {briefing.map((line) => (
                <li key={line}>· {line}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.9fr)]">
          <div className="relative min-h-[520px] overflow-hidden">
            {!solution && !busy && (
              <div className="pointer-events-none absolute inset-x-4 top-14 z-10 border border-ink/20 bg-snow/95 p-3 font-sans text-[13px] text-mute">
                Map shows today’s stops. After you run a plan, colored lines are each van’s route. Click a stop for
                details.
              </div>
            )}
            <CityMap
              scenario={scenario}
              solution={solution}
              selectedId={selectedId}
              focusVehicle={focusVehicle}
              hoverVehicle={hoverVehicle}
              playMin={playMin}
              unavailableVehicleIds={unavailableVehicleIds}
              onSelect={setSelectedId}
              onFocusVehicle={setFocusVehicle}
            />
            {unavailableVehicleIds[0] && (
              <p className="pointer-events-none absolute left-3 top-3 z-[600] border border-coral bg-[#FFF5F2] px-3 py-1.5 font-sans text-[12px] font-semibold text-ink">
                ⚠ Vehicle {unavailableVehicleIds[0]} UNAVAILABLE
              </p>
            )}
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
          <div className="flex max-h-[min(760px,70vh)] flex-col gap-3 overflow-y-auto pr-1">
            <p className="font-sans text-[12px] font-semibold uppercase tracking-wide text-mute">
              Vans & drivers{focusVehicle ? ` · focused ${focusVehicle}` : ""}
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
            <DeferredList
              items={solution?.unassigned ?? []}
              reasons={solution?.constraint_log ?? []}
              onSelect={setSelectedId}
            />
            <ConstraintLog items={solution?.constraint_log ?? []} />
            <HistoryPanel items={history} />
          </div>
        </div>

        {scenario && (
          <OrderBoard
            orders={scenario.orders}
            solution={solution}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        )}

        <footer className="border-t border-hairline pt-3 font-sans text-[12px] text-mute">
          Shortcuts: 1/2 Day A/B · 3 Load Scenario · B naive · O Nexus · Esc closes panels · click van to focus route
        </footer>
      </div>
    </div>
  );
}
