/**
 * Auth-optional hackathon Lab API — synthetic scenario + real OR-Tools run.
 */
import { apiUrl } from "./apiUrl";
import type { Solution } from "../types";

export interface LabOrder {
  order_id: string;
  lat: number;
  lon: number;
  demand: number;
  tw_start: number;
  tw_end: number;
  service_min: number;
  priority: "critical" | "normal";
  zone: string;
  customer: string;
  address: string;
}

export interface LabVehicle {
  vehicle_id: string;
  capacity: number;
  depot_lat: number;
  depot_lon: number;
  shift_start: number;
  shift_end: number;
  driver: string;
  plate: string;
}

export interface LabScenarioPayload {
  scenario_id: string;
  seed: number;
  code: string;
  name: string;
  depot: [number, number];
  depot_address: string;
  orders: LabOrder[];
  vehicles: LabVehicle[];
  summary: {
    orders: number;
    vehicles: number;
    critical: number;
    total_demand: number;
  };
}

export interface LabComparisonRow {
  key: string;
  metric: string;
  baseline: number;
  optimized: number;
  delta: number;
  improvement_pct: number | null;
  better_when?: string;
}

export interface LabRunResult {
  scenario_id: string;
  excluded_vehicles: string[];
  feasible: boolean;
  partial: boolean;
  baseline: Solution;
  optimize: Solution;
  comparison: LabComparisonRow[];
  improvements: string[];
  data_disclosure: string;
  travel_source: { baseline: string; optimize: string };
  ml_metrics?: Record<string, unknown>;
  triage_note?: string;
}

async function labFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail = res.statusText;
    try {
      const body = JSON.parse(text) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      if (text) detail = text.slice(0, 240);
    }
    if (res.status === 404 || text.includes("NOT_FOUND")) {
      throw new Error("API unavailable. Start the FastAPI backend or set VITE_API_BASE_URL.");
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function loadSyntheticScenario(): Promise<LabScenarioPayload> {
  return labFetch<LabScenarioPayload>("/api/lab/synthetic", { method: "POST" });
}

export function runLabOptimize(payload: {
  scenario_id: string;
  orders: LabOrder[];
  vehicles: LabVehicle[];
  exclude_vehicle_ids?: string[];
  depot_lat?: number;
  depot_lon?: number;
}): Promise<LabRunResult> {
  return labFetch<LabRunResult>("/api/lab/run", {
    method: "POST",
    body: JSON.stringify({
      scenario_id: payload.scenario_id,
      orders: payload.orders,
      vehicles: payload.vehicles,
      exclude_vehicle_ids: payload.exclude_vehicle_ids ?? [],
      depot_lat: payload.depot_lat ?? 12.9716,
      depot_lon: payload.depot_lon ?? 77.5946,
    }),
  });
}
