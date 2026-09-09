/** Persist Lab run metrics for Presentation slide 8 + return navigation. */

const KEY = "nexus-lab-session-v1";

export interface LabSessionSnapshot {
  returnTo?: string;
  slide?: number;
  summary?: {
    orders: number;
    vehicles: number;
    critical: number;
    total_demand: number;
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
    };
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
  try {
    sessionStorage.setItem(KEY, JSON.stringify(cur));
  } catch {
    /* ignore */
  }
}
