/**
 * Targeted Lab session + vehicle style self-tests (no browser).
 * Run: npx tsx src/lib/labDemo.selftest.ts
 */
import assert from "node:assert/strict";
import { persistLabCompareSession, readLabSession, writeLabSession, clearLabMetrics } from "./labSession";
import { vehicleVisual, patternCss } from "./vehicleStyle";

// sessionStorage polyfill for Node
const store = new Map<string, string>();
(globalThis as unknown as { sessionStorage: Storage }).sessionStorage = {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => {
    store.set(k, String(v));
  },
  removeItem: (k) => {
    store.delete(k);
  },
  clear: () => store.clear(),
  key: () => null,
  length: 0,
};

clearLabMetrics();
writeLabSession({ returnTo: "/presentation?slide=7", slide: 7 });
persistLabCompareSession({
  scenarioId: "lab",
  orders: 18,
  vehicles: 4,
  critical: 3,
  totalDemand: 90,
  generationId: "lab-test",
  baseline: { distance_km: 40, late_count: 5, hard_breaches: 2, unassigned_count: 1 },
  optimize: {
    distance_km: 32,
    late_count: 1,
    hard_breaches: 0,
    unassigned_count: 0,
    feasible: true,
    partial: false,
  },
  highRiskCount: 2,
  travelSource: "haversine",
});

const snap = readLabSession();
assert.equal(snap.slide, 7);
assert.equal(snap.scenario_id, "lab");
assert.equal(snap.summary?.orders, 18);
assert.equal(snap.metrics?.nexus.late_count, 1);
assert.equal(snap.metrics?.before.late_count, 5);
assert.equal(snap.metrics?.high_risk_count, 2);

writeLabSession({
  disruption: {
    vehicle_id: "V02",
    affected_orders: 4,
    before_late: 1,
    after_late: 2,
    before_distance_km: 32,
    after_distance_km: 36,
    updatedAt: new Date().toISOString(),
  },
});
assert.equal(readLabSession().disruption?.vehicle_id, "V02");

const v1 = vehicleVisual("V01");
const v2 = vehicleVisual("V02");
assert.notEqual(v1.patternLabel, v2.patternLabel);
assert.ok(["solid", "dashed", "dotted", "dash-dot"].includes(v1.patternLabel));
assert.ok(typeof patternCss(v1.patternLabel) === "string");

console.log("labDemo.selftest OK");
