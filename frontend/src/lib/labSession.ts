/** Persist Lab run metrics for Presentation slides 7–9 + return navigation. */

const KEY = "nexus-lab-session-v1";

export interface LabSessionSnapshot {
  returnTo?: string;
  slide?: number;
  scenario_id?: string;
  summary?: {
    orders: number;
    vehicles: number;
    critical: number;
    total_demand: number;
    generation_id?: string;
  };
  metrics?: {
    before: {
      distance_km: number;
      late_count: number;
      hard_breaches: number;
      unassigned_count: number;
    };
    nexus: {
      distance_km: number;
      late_count: number;
      hard_breaches: number;
      unassigned_count: number;
      feasible: boolean;
      partial: boolean;
      criticals_served?: number;
      time_min?: number;
    };
    high_risk_count?: number;
    travel_source?: string;
    updatedAt: string;
  };
  disruption?: {
    vehicle_id: string;
    affected_orders: number;
    before_late: number;
    after_late: number;
    before_distance_km: number;
    after_distance_km: number;
    updatedAt: string;
  };
}

export function readLabSession(): LabSessionSnapshot {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as LabSessionSnapshot;
  } catch {
    return {};
  }
}

export function writeLabSession(patch: Partial<LabSessionSnapshot>): LabSessionSnapshot {
  const next = { ...readLabSession(), ...patch };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
  return next;
}

export function clearLabMetrics(): void {
  const cur = readLabSession();
  delete cur.metrics;
  delete cur.summary;
  delete cur.disruption;
  delete cur.scenario_id;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(cur));
  } catch {
    /* ignore */
  }
}

/** Persist only fields present on a real solution / scenario — no fabrication. */
export function persistLabCompareSession(args: {
  scenarioId: string;
  orders: number;
  vehicles: number;
  critical: number;
  totalDemand: number;
  generationId?: string | null;
  baseline: {
    distance_km: number;
    late_count: number;
    hard_breaches: number;
    unassigned_count: number;
  };
  optimize: {
    distance_km: number;
    late_count: number;
    hard_breaches: number;
    unassigned_count: number;
    feasible: boolean;
    partial: boolean;
    criticals_served?: number;
    time_min?: number;
  };
  highRiskCount: number;
  travelSource: string;
}): LabSessionSnapshot {
  return writeLabSession({
    scenario_id: args.scenarioId,
    summary: {
      orders: args.orders,
      vehicles: args.vehicles,
      critical: args.critical,
      total_demand: args.totalDemand,
      generation_id: args.generationId ?? undefined,
    },
    metrics: {
      before: args.baseline,
      nexus: args.optimize,
      high_risk_count: args.highRiskCount,
      travel_source: args.travelSource,
      updatedAt: new Date().toISOString(),
    },
  });
}
