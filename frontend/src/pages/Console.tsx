import { useCallback, useEffect, useMemo, useState } from "react";
import { Cloud, Download, FileText, HelpCircle, Loader2, Map as MapIcon, Play, X } from "lucide-react";
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
import { GuideBanner } from "../components/GuideBanner";
import { HistoryPanel } from "../components/HistoryPanel";
import { LoadingOverlay } from "../components/LoadingOverlay";
import { OrderBoard } from "../components/OrderBoard";
import { RiskInspector } from "../components/RiskInspector";
import { Scoreboard } from "../components/Scoreboard";
import { BrandLogo } from "../components/BrandLogo";
import { VehicleRail } from "../components/VehicleRail";
import { WinSheetPanel } from "../components/WinSheetPanel";
import { fmtClock } from "../lib/format";
import type { Metrics, ScenarioDetail, Solution, SolveMode, Stop, Weather } from "../types";

interface ConsoleProps {
  onBack: () => void;
}

type BusyMode = SolveMode | "compare" | null;

export function Console({ onBack }: ConsoleProps) {
  const [scenarioId, setScenarioId] = useState<"a" | "b">("a");
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
    setError(null);
    setBriefing([]);
    setPlayMin(null);
    setPlaying(false);
    setComparisonRows([]);
    setTravelPair(null);
    Promise.all([reloadScenario(scenarioId), reloadHistory(scenarioId)]).catch((e: Error) => {
      if (!cancelled) setError(e.message);
    });
    return () => {
      cancelled = true;
    };
  }, [scenarioId, reloadScenario, reloadHistory]);

  const run = useCallback(
    async (mode: SolveMode) => {
      setSolving(mode);
      setError(null);
      setPlaying(false);
      setPlayMin(null);
      try {
        const result = await solve(scenarioId, mode);
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
        ]);
        if (mode === "baseline") {
          setBaselines((prev) => ({ ...prev, [scenarioId]: result.metrics }));
        }
        setToast(mode === "optimize" ? "Smart plan ready. Check the map and scoreboard." : "Naive plan ready.");
        setShowHelp(false);
        await reloadHistory(scenarioId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Solve failed");
      } finally {
        setSolving(null);
      }
    },
    [scenarioId, reloadHistory],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedId(null);
        setExportKind(null);
      }
      if (e.key === "1") setScenarioId("a");
      if (e.key === "2") setScenarioId("b");
      if (e.key === "b" && !e.metaKey && !e.ctrlKey) void run("baseline");
      if (e.key === "o" && !e.metaKey && !e.ctrlKey) void run("optimize");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run]);

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
        "Compared naive vs smart on the same day.",
        ...(result.improvements?.slice(0, 3) ?? []),
        `Late Δ ${result.deltas.late_count} · Distance Δ ${result.deltas.distance_km} km.`,
      ]);
      setToast("Comparison complete. See the improvement table.");
      setShowHelp(false);
      await reloadHistory(scenarioId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Compare failed");
    } finally {
      setSolving(null);
    }
  }, [scenarioId, reloadHistory]);

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
      return { stop: null as Stop | null, order: null, vehicleId: null as string | null };
    }
    const order = scenario.orders.find((o) => o.order_id === selectedId) ?? null;
    const unassigned = solution?.unassigned.find((u) => u.order_id === selectedId) ?? null;
    let stop: Stop | null = null;
    let vehicleId: string | null = null;
    if (solution) {
      for (const r of solution.routes) {
        const found = r.stops.find((s) => s.order_id === selectedId);
        if (found) {
          stop = found;
          vehicleId = r.vehicle_id;
          break;
        }
      }
    }
    return { stop, order: order ?? unassigned, vehicleId };
  }, [selectedId, scenario, solution]);

  const idleRoutes = useMemo(() => {
    if (solution) return solution.routes;
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
  }, [solution, scenario]);

  const baseline = baselines[scenarioId] ?? null;
  const showDeltas = Boolean(solution && solution.mode === "optimize" && baseline);
  const busy = solving != null;
  const clockLabel = clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const weatherLabel = weather?.ok ? `${weather.label} · ${weather.temp_c ?? "—"}°C` : "Weather loading…";
  const mode = solution?.mode ?? "optimize";
  const orderCount = scenario?.orders.length ?? 0;
  const vanCount = scenario?.vehicles.length ?? 0;

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
                Plan van stops for Bengaluru. Compare a naive schedule against a smart one. Rules (capacity + time
                windows) are never broken.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowHelp((v) => !v)}
            className="inline-flex min-h-10 items-center gap-2 border border-hairline px-3 py-2 font-sans text-[13px] font-semibold text-ink hover:border-ink"
          >
            <HelpCircle size={16} />
            {showHelp ? "Hide help" : "Show help"}
          </button>
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
                <span className="font-semibold text-ink">Pick a day</span>
                <br />
                Day A = normal. Day B = too many stops (shows deferred work).
              </li>
              <li>
                <span className="font-semibold text-ink">Run Naive plan</span>
                <br />
                Shows a weak schedule. Expect late deliveries.
              </li>
              <li>
                <span className="font-semibold text-ink">Run Smart optimize</span>
                <br />
                Improves routes. Scoreboard shows the difference.
              </li>
            </ol>
            <p className="mt-3 font-sans text-[13px] text-mute">
              Tip: click any stop on the map to see late-risk advice. Risk never changes the route by itself.
            </p>
          </section>
        )}

        <header className="border border-hairline bg-snow">
          <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-3">
            <div>
              <p className="font-sans text-[12px] font-semibold uppercase tracking-wide text-mute">Which day?</p>
              <div className="mt-1 flex overflow-hidden border border-hairline" role="group" aria-label="Which day to plan">
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
              </div>
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
                Compare both
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
                Smart optimize
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
          scenarioId={scenarioId}
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
          <div className="relative min-h-[520px]">
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
              hoverVehicle={hoverVehicle}
              playMin={playMin}
              onSelect={setSelectedId}
            />
            {selectedId && (
              <RiskInspector
                stop={selected.stop}
                order={selected.order}
                vehicleId={selected.vehicleId}
                held={held.includes(selectedId)}
                onClose={() => setSelectedId(null)}
                onHold={(h) => void onHold(h)}
              />
            )}
          </div>
          <div className="flex max-h-[760px] flex-col gap-3 overflow-y-auto pr-1">
            <p className="font-sans text-[12px] font-semibold uppercase tracking-wide text-mute">Vans & drivers</p>
            <VehicleRail
              routes={idleRoutes}
              hoverVehicle={hoverVehicle}
              onHover={setHoverVehicle}
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
          Shortcuts: 1/2 switch day · B naive plan · O smart optimize · Esc closes panels
        </footer>
      </div>
    </div>
  );
}
