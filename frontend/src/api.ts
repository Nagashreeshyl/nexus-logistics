import { getAuth } from "firebase/auth";
import { apiUrl } from "./lib/apiUrl";
import type { ScenarioDetail, Solution, SolveMode, Weather } from "./types";

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Authorization")) {
    try {
      const user = getAuth().currentUser;
      if (user) {
        const token = await user.getIdToken();
        headers.set("Authorization", `Bearer ${token}`);
      }
    } catch {
      /* Firebase not initialized — continue without auth header */
    }
  }
  const res = await fetch(apiUrl(path), { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 404 || text.includes("NOT_FOUND")) {
      throw new Error(
        "API unavailable (404). Backend may not be deployed. Set VITE_API_BASE_URL.",
      );
    }
    let detail = res.statusText;
    try {
      const body = JSON.parse(text) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      if (text) detail = text.slice(0, 200);
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res;
}

async function parse<T>(res: Response): Promise<T> {
  return res.json() as Promise<T>;
}

export function fetchScenario(id: string): Promise<ScenarioDetail> {
  return apiFetch(`/api/scenarios/${id}`).then((r) => parse<ScenarioDetail>(r));
}

export function fetchWeather(): Promise<Weather> {
  return apiFetch("/api/weather").then((r) => parse<Weather>(r));
}

export function refreshWeather(): Promise<Weather> {
  return apiFetch("/api/weather/refresh", { method: "POST" }).then((r) => parse<Weather>(r));
}

export function solve(scenarioId: string, mode: SolveMode): Promise<Solution> {
  return apiFetch("/api/solve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario_id: scenarioId, mode }),
  }).then((r) => parse<Solution>(r));
}

export interface ComparisonRow {
  metric: string;
  key: string;
  baseline: number;
  optimized: number;
  delta: number;
  improvement_pct: number | null;
  better_when: string;
}

export interface CompareResult {
  scenario_id: string;
  same_scenario: boolean;
  labels: { baseline: string; optimized: string };
  baseline: Solution;
  optimize: Solution;
  comparison: ComparisonRow[];
  improvements: string[];
  deltas: Record<string, number>;
  data_disclosure: string;
  travel_source: { baseline: string; optimize: string };
  briefing: {
    headline: string;
    lines: string[];
    high_risk: { order_id: string; customer: string; p_late: number; van: string }[];
    drivers: {
      vehicle_id: string;
      driver: string;
      plate: string;
      stops: number;
      load: number;
      capacity: number;
      last_eta: number | null;
      lates: number;
      cod_total: number;
    }[];
    cod_collectible: number;
    held: string[];
  };
}

export function compare(scenarioId: string): Promise<CompareResult> {
  return apiFetch(`/api/compare?scenario_id=${scenarioId}`, { method: "POST" }).then((r) =>
    parse<CompareResult>(r),
  );
}

export interface WinSheet {
  scenario_id: string;
  problem: string;
  built: string;
  why_intelligent: string[];
  measured: ComparisonRow[];
  improved: string[];
  when_no_perfect_solution: {
    partial: boolean;
    deferred_count: number;
    note: string;
  };
  data_used: string;
  limitations: string[];
  travel_source_optimize: string;
  baseline_note?: string;
  optimized_note?: string;
  risk_model?: {
    holdout_metrics?: {
      accuracy?: number;
      precision?: number;
      recall?: number;
      f1?: number;
      roc_auc?: number;
      confusion_matrix?: number[][];
    };
    pre_route_metrics?: {
      accuracy?: number;
      precision?: number;
      recall?: number;
      f1?: number;
      roc_auc?: number;
    };
    excluded_features?: string[];
    not_production_validated?: boolean;
  };
}

export function fetchWinSheet(scenarioId: string): Promise<WinSheet> {
  return apiFetch(`/api/winsheet?scenario_id=${scenarioId}`).then((r) => parse<WinSheet>(r));
}

export function setHold(scenarioId: string, orderId: string, held: boolean): Promise<{ held: string[] }> {
  return apiFetch("/api/holds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario_id: scenarioId, order_id: orderId, held }),
  }).then((r) => parse<{ held: string[] }>(r));
}

export function clearHolds(scenarioId: string): Promise<{ held: string[] }> {
  return apiFetch(`/api/holds/${scenarioId}`, { method: "DELETE" }).then((r) =>
    parse<{ held: string[] }>(r),
  );
}

export function fetchHistory(scenarioId: string): Promise<{
  items: {
    id: number;
    scenario_id: string;
    mode: string;
    travel_source: string;
    metrics: {
      late_count: number;
      distance_km: number;
      hard_breaches: number;
      unassigned_count: number;
    };
    created_at: string;
  }[];
}> {
  return apiFetch(`/api/history?scenario_id=${scenarioId}&limit=8`).then((r) =>
    parse<{
      items: {
        id: number;
        scenario_id: string;
        mode: string;
        travel_source: string;
        metrics: {
          late_count: number;
          distance_km: number;
          hard_breaches: number;
          unassigned_count: number;
        };
        created_at: string;
      }[];
    }>(r),
  );
}

export function manifestUrl(scenarioId: string, mode: SolveMode): string {
  return apiUrl(`/api/manifest?scenario_id=${scenarioId}&mode=${mode}`);
}

export function geojsonUrl(scenarioId: string, mode: SolveMode): string {
  return apiUrl(`/api/geojson?scenario_id=${scenarioId}&mode=${mode}`);
}
