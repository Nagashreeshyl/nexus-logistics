import type { ComparisonRow } from "../../api";
import type { LabArchetype } from "../../lib/labApi";
import type { Metrics, Order, RoutePlan, ScenarioDetail, Solution, SolveMode, Stop, Weather } from "../../types";

export type BusyMode = SolveMode | "compare" | "synthetic" | "breakdown" | "rush" | null;
export type DayId = "a" | "b" | "lab";
export type PlaySpeed = 0.5 | 1 | 2 | 4;
export type MapTimeline = "after" | "before";
export type PlanViewMode = "split" | "nexus" | "baseline";

export type HistoryItem = {
  id: number;
  mode: string;
  travel_source: string;
  created_at: string;
  metrics: { late_count: number; distance_km: number; hard_breaches: number; unassigned_count: number };
};

export const PLAY_SPEEDS: PlaySpeed[] = [0.5, 1, 2, 4];
export const BASE_PLAY_MS = 12_000;

export const ARCHETYPE_OPTIONS: { id: LabArchetype; label: string; hint: string }[] = [
  { id: "balanced", label: "Balanced", hint: "Typical day" },
  { id: "surge", label: "Surge", hint: "More orders / criticals" },
  { id: "tight_windows", label: "Tight windows", hint: "Narrow TW pressure" },
  { id: "fleet_shortage", label: "Fleet short", hint: "Fewer vans" },
];

export const LAB_NAV = [
  { to: "/optimizer", end: true, label: "Overview" },
  { to: "/optimizer/scenario", end: false, label: "Scenario" },
  { to: "/optimizer/plan", end: false, label: "Plan" },
  { to: "/optimizer/risk", end: false, label: "Risk" },
  { to: "/optimizer/exceptions", end: false, label: "Exceptions" },
  { to: "/optimizer/analytics", end: false, label: "Analytics" },
  { to: "/optimizer/evidence", end: false, label: "Evidence" },
  { to: "/optimizer/exports", end: false, label: "Exports" },
] as const;

export function pickHighestRiskOrderId(sol: Solution, minP = 0.55): string | null {
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

export function highRiskStops(sol: Solution | null, minP = 0.55) {
  if (!sol) return [] as { order_id: string; vehicle_id: string; p_late: number; stop: Stop }[];
  const out: { order_id: string; vehicle_id: string; p_late: number; stop: Stop }[] = [];
  for (const r of sol.routes) {
    for (const s of r.stops) {
      const p = s.risk?.p_late ?? 0;
      if (p >= minP) out.push({ order_id: s.order_id, vehicle_id: r.vehicle_id, p_late: p, stop: s });
    }
  }
  return out.sort((a, b) => b.p_late - a.p_late);
}

export function onTimePct(lateCount: number, orderCount: number): number | null {
  if (orderCount <= 0) return null;
  return Math.max(0, Math.min(100, ((orderCount - lateCount) / orderCount) * 100));
}

export type { ComparisonRow, LabArchetype, Metrics, Order, RoutePlan, ScenarioDetail, Solution, SolveMode, Stop, Weather };
