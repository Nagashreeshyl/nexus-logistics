import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  clearHolds,
  compare,
  fetchHistory,
  fetchScenario,
  refreshWeather,
  setHold,
  solve,
  type ComparisonRow,
} from "../../api";
import { apiUrl } from "../../lib/apiUrl";
import { loadSyntheticScenario, runLabOptimize, type LabArchetype } from "../../lib/labApi";
import { persistLabCompareSession, writeLabSession } from "../../lib/labSession";
import type { ExportKind } from "../../components/ExportViewer";
import type { Metrics, Order, RoutePlan, ScenarioDetail, Solution, SolveMode, Stop, Unassigned, Weather } from "../../types";
import {
  ARCHETYPE_OPTIONS,
  BASE_PLAY_MS,
  pickHighestRiskOrderId,
  type BusyMode,
  type DayId,
  type HistoryItem,
  type MapTimeline,
  type PlanViewMode,
  type PlaySpeed,
} from "./labTypes";

type LabContextValue = {
  scenarioId: DayId;
  setScenarioId: (id: DayId) => void;
  labGenerationId: string | null;
  scenario: ScenarioDetail | null;
  scenarioLoading: boolean;
  solution: Solution | null;
  baselineSolution: Solution | null;
  baselines: Record<string, Metrics>;
  solving: BusyMode;
  stage: number;
  error: string | null;
  setError: (e: string | null) => void;
  toast: string | null;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  hoverVehicle: string | null;
  setHoverVehicle: (id: string | null) => void;
  focusVehicle: string | null;
  setFocusVehicle: (id: string | null) => void;
  breakdownVehicle: string | null;
  setBreakdownVehicle: (id: string | null) => void;
  unavailableVehicleIds: string[];
  preDisruption: Solution | null;
  held: string[];
  weather: Weather | null;
  briefing: string[];
  history: HistoryItem[];
  cacheMode: string;
  playMin: number | null;
  playing: boolean;
  setPlaying: (v: boolean) => void;
  playSpeed: PlaySpeed;
  setPlaySpeed: (s: PlaySpeed) => void;
  exportKind: ExportKind | null;
  setExportKind: (k: ExportKind | null) => void;
  comparisonRows: ComparisonRow[];
  travelPair: { baseline: string; optimize: string } | null;
  winOpen: boolean;
  setWinOpen: (v: boolean) => void;
  disclosure: string;
  mapTimeline: MapTimeline;
  setMapTimeline: (t: MapTimeline) => void;
  planView: PlanViewMode;
  setPlanView: (m: PlanViewMode) => void;
  archetype: LabArchetype;
  rushOrderId: string | null;
  comparedOnce: boolean;
  isLab: boolean;
  busy: boolean;
  baseline: Metrics | null;
  showDeltas: boolean;
  orderCount: number;
  vanCount: number;
  criticalCount: number;
  highRiskCount: number;
  clockLabel: string;
  weatherLabel: string;
  mode: SolveMode;
  selected: {
    stop: Stop | null;
    order: Order | Unassigned | null;
    vehicleId: string | null;
    route: RoutePlan | null;
  };
  idleRoutes: RoutePlan[];
  mapShowCompare: boolean;
  mapSolution: Solution | null;
  mapUnavailableIds: string[];
  jp019Items: { id: string; label: string; done: boolean; detail?: string }[];
  loadNewSynthetic: (arch?: LabArchetype) => Promise<void>;
  run: (mode: SolveMode) => Promise<void>;
  runCompare: () => Promise<void>;
  simulateBreakdown: () => Promise<void>;
  clearDisruption: () => void;
  injectRushOrder: () => Promise<void>;
  onHold: (nextHeld: boolean) => Promise<void>;
  onClearHolds: () => Promise<void>;
  onWeather: () => Promise<void>;
  onBack: () => void;
};

const LabContext = createContext<LabContextValue | null>(null);

export function useLab(): LabContextValue {
  const ctx = useContext(LabContext);
  if (!ctx) throw new Error("useLab must be used within LabProvider");
  return ctx;
}

export function LabProvider({ children, onBack }: { children: ReactNode; onBack: () => void }) {
  const navigate = useNavigate();
  const [scenarioId, setScenarioId] = useState<DayId>("a");
  const [labGenerationId, setLabGenerationId] = useState<string | null>(null);
  const [scenario, setScenario] = useState<ScenarioDetail | null>(null);
  const [scenarioLoading, setScenarioLoading] = useState(true);
  const [solution, setSolution] = useState<Solution | null>(null);
  const [baselineSolution, setBaselineSolution] = useState<Solution | null>(null);
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
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [cacheMode, setCacheMode] = useState("");
  const [playMin, setPlayMin] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState<PlaySpeed>(1);
  const [exportKind, setExportKind] = useState<ExportKind | null>(null);
  const [clock, setClock] = useState(() => new Date());
  const [comparisonRows, setComparisonRows] = useState<ComparisonRow[]>([]);
  const [travelPair, setTravelPair] = useState<{ baseline: string; optimize: string } | null>(null);
  const [winOpen, setWinOpen] = useState(false);
  const [disclosure, setDisclosure] = useState("");
  const [mapTimeline, setMapTimeline] = useState<MapTimeline>("after");
  const [planView, setPlanView] = useState<PlanViewMode>("split");
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
    setBaselineSolution(null);
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
          setError("No synthetic scenario yet — click Load on Scenario to generate one.");
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
      setBaselineSolution(null);
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
          `SYNTHETIC · ${archLabel.toUpperCase()} — fresh Bengaluru day.`,
          `${payload.summary.orders} orders · ${payload.summary.vehicles} vans · ${payload.summary.critical} critical.`,
          "Run Optimize to compare Baseline vs Nexus.",
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
        setToast(`${archLabel} loaded · ${payload.summary.orders} orders · ${payload.summary.vehicles} vans`);
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
          setBaselineSolution(result);
        }
        await reloadHistory(scenarioId);
        setSolution(result);
        if (result.weather) setWeather(result.weather);
        setBriefing([
          mode === "baseline" ? "Naive baseline plan ready." : "Nexus optimize plan ready.",
          `Late ${result.metrics.late_count} · ${result.metrics.distance_km.toFixed(1)} km.`,
          result.partial
            ? `${result.unassigned.length} stops deferred under hard constraints.`
            : "All stops assigned without breaking capacity or windows.",
        ]);
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
          const riskId = pickHighestRiskOrderId(result);
          if (riskId) setSelectedId(riskId);
        }
        setToast(mode === "optimize" ? "Nexus plan ready." : "Baseline plan ready.");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Solve failed");
      } finally {
        setSolving(null);
      }
    },
    [scenarioId, reloadHistory, baselines, scenario, labGenerationId],
  );

  const runCompare = useCallback(async () => {
    setSolving("compare");
    setError(null);
    setPlaying(false);
    try {
      const result = await compare(scenarioId);
      setBaselines((prev) => ({ ...prev, [scenarioId]: result.baseline.metrics }));
      setBaselineSolution(result.baseline);
      setSolution(result.optimize);
      setComparisonRows(result.comparison ?? []);
      setTravelPair(result.travel_source ?? null);
      setDisclosure(result.data_disclosure ?? "");
      setComparedOnce(true);
      setMapTimeline("after");
      setPlanView("split");
      if (result.optimize.weather) setWeather(result.optimize.weather);
      setBriefing([
        isLab ? "Compared Baseline vs Nexus on this synthetic day." : "Compared Baseline vs Nexus on the same day.",
        ...(result.improvements?.slice(0, 3) ?? []),
        `Late Δ ${result.deltas.late_count} · Distance Δ ${result.deltas.distance_km} km.`,
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
      setToast("Optimization complete — opening Plan & Compare.");
      navigate("/optimizer/plan");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Compare failed");
    } finally {
      setSolving(null);
    }
  }, [scenarioId, isLab, reloadHistory, scenario, labGenerationId, navigate]);

  const simulateBreakdown = useCallback(async () => {
    if (!scenario || !solution || !breakdownVehicle) return;
    setSolving("breakdown");
    setError(null);
    setPlaying(false);
    try {
      const before = solution;
      setPreDisruption(structuredClone(before));
      const affected = before.routes.find((r) => r.vehicle_id === breakdownVehicle)?.stops.length ?? 0;
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
      setBaselineSolution(result.baseline);
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
        `Vehicle ${breakdownVehicle} UNAVAILABLE — ${affected} stops on prior route.`,
        "Reoptimized with remaining fleet via OR-Tools.",
        `Late ${before.metrics.late_count} → ${result.optimize.metrics.late_count}.`,
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
      setToast(`Breakdown simulated — ${breakdownVehicle} excluded.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Breakdown reoptimization failed");
      setPreDisruption(null);
      setUnavailableVehicleIds([]);
    } finally {
      setSolving(null);
    }
  }, [scenario, solution, breakdownVehicle, scenarioId]);

  const clearDisruption = useCallback(() => {
    setUnavailableVehicleIds([]);
    setBreakdownVehicle(null);
    setPreDisruption(null);
    setMapTimeline("after");
    setToast("Disruption cleared.");
  }, []);

  const injectRushOrder = useCallback(async () => {
    if (!scenario) return;
    setSolving("rush");
    setError(null);
    setPlaying(false);
    try {
      const before = solution;
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
      setScenario({ ...scenario, orders: nextOrders });
      setRushOrderId(rushId);
      setBaselineSolution(result.baseline);
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
        `Rush ${rushId} injected (critical).`,
        before
          ? `Late ${before.metrics.late_count} → ${result.optimize.metrics.late_count}.`
          : `Late ${result.optimize.metrics.late_count}.`,
      ]);
      setToast(`Rush ${rushId} inserted — reoptimized.`);
      navigate("/optimizer/exceptions");
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Rush inject failed";
      setError(
        /cp solver fail/i.test(raw)
          ? "Optimizer could not place the rush stop under hard windows/capacity — try a fresh scenario."
          : raw,
      );
    } finally {
      setSolving(null);
    }
  }, [scenario, solution, scenarioId, unavailableVehicleIds, navigate]);

  const onHold = useCallback(
    async (nextHeld: boolean) => {
      if (!selectedId) return;
      try {
        const res = await setHold(scenarioId, selectedId, nextHeld);
        setHeld(res.held);
        await reloadScenario(scenarioId);
        if (solution) await run(solution.mode);
        setToast(nextHeld ? `Held ${selectedId}` : `Released ${selectedId}`);
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

  useEffect(() => {
    if (!playing || !solution) return;
    const etas = [
      ...solution.routes.flatMap((r) => r.stops.map((s) => s.eta_min)),
      ...(baselineSolution?.routes.flatMap((r) => r.stops.map((s) => s.eta_min)) ?? []),
    ];
    const maxEta = Math.max(0, ...etas, 1);
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
  }, [playing, solution, baselineSolution, playSpeed]);

  const selected = useMemo(() => {
    if (!selectedId || !scenario) {
      return { stop: null as Stop | null, order: null, vehicleId: null as string | null, route: null as RoutePlan | null };
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

  const baseline = baselines[scenarioId] ?? baselineSolution?.metrics ?? null;
  const showDeltas = Boolean(solution && solution.mode === "optimize" && baseline);
  const busy = solving != null;
  const clockLabel = clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const weatherLabel = weather?.ok ? `${weather.label} · ${weather.temp_c ?? "—"}°C` : "Weather…";
  const mode = solution?.mode ?? "optimize";
  const orderCount = scenario?.orders.length ?? 0;
  const vanCount = scenario?.vehicles.length ?? 0;
  const criticalCount = scenario?.orders.filter((o) => o.priority === "critical").length ?? 0;
  const highRiskCount =
    solution?.routes.reduce((n, r) => n + r.stops.filter((s) => (s.risk?.p_late ?? 0) >= 0.55).length, 0) ?? 0;
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
      detail: highRiskCount > 0 ? `${highRiskCount} stops p_late ≥ 0.55` : "Open Risk after Optimize",
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
            : "Use Exceptions page",
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

  const value: LabContextValue = {
    scenarioId,
    setScenarioId,
    labGenerationId,
    scenario,
    scenarioLoading,
    solution,
    baselineSolution,
    baselines,
    solving,
    stage,
    error,
    setError,
    toast,
    selectedId,
    setSelectedId,
    hoverVehicle,
    setHoverVehicle,
    focusVehicle,
    setFocusVehicle,
    breakdownVehicle,
    setBreakdownVehicle,
    unavailableVehicleIds,
    preDisruption,
    held,
    weather,
    briefing,
    history,
    cacheMode,
    playMin,
    playing,
    setPlaying,
    playSpeed,
    setPlaySpeed,
    exportKind,
    setExportKind,
    comparisonRows,
    travelPair,
    winOpen,
    setWinOpen,
    disclosure,
    mapTimeline,
    setMapTimeline,
    planView,
    setPlanView,
    archetype,
    rushOrderId,
    comparedOnce,
    isLab,
    busy,
    baseline,
    showDeltas,
    orderCount,
    vanCount,
    criticalCount,
    highRiskCount,
    clockLabel,
    weatherLabel,
    mode,
    selected,
    idleRoutes,
    mapShowCompare,
    mapSolution,
    mapUnavailableIds,
    jp019Items,
    loadNewSynthetic,
    run,
    runCompare,
    simulateBreakdown,
    clearDisruption,
    injectRushOrder,
    onHold,
    onClearHolds,
    onWeather,
    onBack,
  };

  return <LabContext.Provider value={value}>{children}</LabContext.Provider>;
}
