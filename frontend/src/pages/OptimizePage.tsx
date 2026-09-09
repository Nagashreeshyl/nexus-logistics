import { useMemo, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../firebase/AuthProvider";
import {
  mergeConnection,
  useRealtimeDrivers,
  useRealtimeOptimizationRuns,
  useRealtimeOrders,
  useRealtimeVehicles,
} from "../hooks/useRealtimeOps";
import { OpsPageShell, MetricGrid } from "../components/ops/OpsPageShell";
import { useToast } from "../components/ops/useToast";
import { getFirebase } from "../firebase/config";
import { apiUrl } from "../lib/apiUrl";
import { assignOrderDelivery } from "../services/firestore/entityCrud";
import { formatLastSeen } from "../components/ops/OpsBadges";

function metric(v: unknown): string | number {
  if (v === null || v === undefined || (typeof v === "number" && Number.isNaN(v))) return "N/A";
  return v as string | number;
}

export function OptimizePage() {
  const { profile, firebaseUser, getIdToken, can } = useAuth();
  const orgId = profile?.organizationId;
  const ordersQ = useRealtimeOrders(orgId);
  const vehiclesQ = useRealtimeVehicles(orgId);
  const driversQ = useRealtimeDrivers(orgId);
  const runsQ = useRealtimeOptimizationRuns(orgId);
  const connection = mergeConnection(ordersQ.connection, vehiclesQ.connection, runsQ.connection);
  const { show, toastEl } = useToast();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Record<string, any> | null>(null);
  const [optError, setOptError] = useState<string | null>(null);

  const openOrders = useMemo(
    () => ordersQ.data.filter((o) => !["COMPLETED", "CANCELLED", "FAILED"].includes(String(o.status))),
    [ordersQ.data],
  );
  const availableVehicles = useMemo(
    () =>
      vehiclesQ.data.filter(
        (v) => v.active !== false && !["INACTIVE", "BREAKDOWN", "MAINTENANCE"].includes(String(v.status)),
      ),
    [vehiclesQ.data],
  );

  async function runOptimize() {
    if (!can("run_optimization") && !can("manage_orders")) {
      show("Not authorized", "err");
      return;
    }
    setBusy(true);
    setOptError(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error("Missing Firebase ID token");
      const payload = {
        organization_id: orgId,
        orders: openOrders.map((o) => ({
          id: o.id,
          order_id: o.id,
          lat: o.latitude,
          lon: o.longitude,
          demandKg: o.demandKg,
          timeWindowStart: o.timeWindowStart,
          timeWindowEnd: o.timeWindowEnd,
          serviceDurationMinutes: o.serviceDurationMinutes ?? 15,
          priority: o.priority,
          customerName: o.customerName,
          destination: o.destination ?? o.address,
        })),
        vehicles: availableVehicles.map((v) => {
          const driver = driversQ.data.find((d) => d.id === (v.driverId ?? v.assignedDriverId));
          return {
            id: v.id,
            vehicle_id: v.id,
            capacityKg: v.capacityKg ?? v.capacity,
            registrationNumber: v.registrationNumber,
            driver: driver?.name ?? "",
            shift_start: driver?.shiftStart ?? "08:00",
            shift_end: driver?.shiftEnd ?? "18:00",
          };
        }),
      };
      const res = await fetch(apiUrl("/api/ops/optimize-live"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body.detail === "string" ? body.detail : res.statusText);
      }
      const data = await res.json();
      setResult(data);

      // Persist to Firestore so listeners pick it up
      const fb = getFirebase();
      if (fb.configured && orgId && firebaseUser) {
        await addDoc(collection(fb.db, "optimizationRuns"), {
          organizationId: orgId,
          mode: "compare",
          source: "live-firestore",
          metrics: data.optimize?.metrics ?? {},
          comparison: data.comparison ?? [],
          explanations: data.explanations ?? [],
          feasible: data.feasible,
          partial: data.partial,
          ordersConsidered: openOrders.length,
          vehiclesConsidered: availableVehicles.length,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: firebaseUser.uid,
        });
      }
      show("Optimization complete — result written to Firestore");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setOptError(msg);
      show(msg, "err");
    } finally {
      setBusy(false);
    }
  }

  async function applyPlan() {
    if (!result?.optimize || !firebaseUser || !profile || !orgId) return;
    setBusy(true);
    try {
      const actor = { uid: firebaseUser.uid, email: profile.email, organizationId: orgId };
      for (const route of result.optimize.routes ?? []) {
        const vehicle = vehiclesQ.data.find((v) => v.id === route.vehicle_id);
        const driver =
          driversQ.data.find((d) => d.id === (vehicle?.driverId ?? vehicle?.assignedDriverId)) ||
          driversQ.data.find((d) => d.assignedVehicleId === route.vehicle_id);
        if (!vehicle || !driver?.userId) continue;
        for (const stop of route.stops ?? []) {
          const order = ordersQ.data.find((o) => o.id === stop.order_id);
          if (!order) continue;
          await assignOrderDelivery({ actor, order, driver, vehicle });
        }
      }
      show("Plan applied — deliveries assigned via Firestore");
    } catch (e) {
      show(e instanceof Error ? e.message : String(e), "err");
    } finally {
      setBusy(false);
    }
  }

  const opt = result?.optimize?.metrics;

  return (
    <OpsPageShell
      title="Optimize Deliveries"
      subtitle="Live Firestore orders/vehicles → existing OR-Tools (hard constraints) + ML risk (advisory)."
      connection={connection}
      actions={
        <button
          type="button"
          disabled={busy || openOrders.length === 0 || availableVehicles.length === 0}
          className="bg-coral px-4 py-2 font-sans text-[13px] font-semibold disabled:opacity-40"
          onClick={() => void runOptimize()}
        >
          {busy ? "Optimization running…" : "Optimize with Nexus AI"}
        </button>
      }
    >
      {toastEl}
      {(ordersQ.loading || vehiclesQ.loading) && (
        <p className="mt-4 font-sans text-[13px] text-mute">Loading live fleet and orders…</p>
      )}
      {optError && (
        <p className="mt-4 border border-coral bg-snow px-3 py-2 font-sans text-[13px] text-coral">
          Optimization failed: {optError}
        </p>
      )}
      {(connection === "offline" || connection === "error") && (
        <p className="mt-4 border border-hairline bg-snow px-3 py-2 font-sans text-[13px] text-mute">
          Connection issue — unable to synchronize. Do not treat inputs as live.
        </p>
      )}
      <MetricGrid
        items={[
          ["Open orders", openOrders.length],
          ["Available vehicles", availableVehicles.length],
          ["Drivers", driversQ.data.length],
          ["Ready", openOrders.length && availableVehicles.length ? "Yes" : "No"],
        ]}
      />

      {openOrders.length === 0 && !ordersQ.loading && (
        <p className="mt-4 font-sans text-[13px] text-mute">
          No open orders — generate a demo scenario from Scenario Studio first.
        </p>
      )}

      <section className="mt-6 border border-hairline bg-snow p-4 font-sans text-[13px] text-mute">
        <p className="font-semibold text-ink">Constraints (hard)</p>
        <ul className="mt-2 list-disc pl-5">
          <li>Vehicle capacity</li>
          <li>Delivery time windows</li>
          <li>Driver shift windows</li>
          <li>Vehicle availability (no breakdown/maintenance)</li>
        </ul>
        <p className="mt-3">ML never overrides feasibility — triage only influences drop preference among normals.</p>
      </section>

      {result && (
        <section className="mt-8 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-sans text-[18px] font-semibold">Baseline vs Nexus AI</h2>
            <span className="font-mono text-[12px] text-mute">
              {result.feasible ? "FEASIBLE" : "INFEASIBLE"} · {result.partial ? "PARTIALLY FEASIBLE" : "FULL"}
            </span>
            <button
              type="button"
              disabled={busy}
              className="border border-ink px-3 py-2 font-sans text-[13px] font-semibold"
              onClick={() => void applyPlan()}
            >
              Approve plan
            </button>
          </div>

          <MetricGrid
            items={[
              ["Orders considered", openOrders.length],
              ["Vehicles used", metric(opt?.vehicles_used)],
              ["Distance km", metric(opt?.distance_km)],
              ["Late deliveries", metric(opt?.late_count)],
              ["TW breaches", metric(opt?.hard_breaches)],
              ["Deferred", metric(opt?.unassigned_count)],
              ["Criticals served", metric(opt?.criticals_served)],
              ["Utilization", metric(opt?.capacity_utilization)],
            ]}
          />

          <div className="overflow-x-auto border border-hairline bg-snow">
            <table className="min-w-full font-mono text-[12px]">
              <thead className="border-b border-hairline bg-paper text-mute">
                <tr>
                  {["Metric", "Baseline", "Nexus AI", "Delta"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(result.comparison ?? []).map((row: any) => (
                  <tr key={row.key} className="border-b border-hairline/70">
                    <td className="px-3 py-2">{row.metric}</td>
                    <td className="px-3 py-2">{metric(row.baseline)}</td>
                    <td className="px-3 py-2 font-semibold">{metric(row.optimized)}</td>
                    <td className="px-3 py-2">{metric(row.delta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border border-hairline bg-snow p-4">
            <p className="sys">Risk / explainability</p>
            <ul className="mt-2 space-y-1 font-sans text-[13px] text-mute">
              {(result.explanations ?? []).length === 0 && <li>N/A</li>}
              {(result.explanations ?? []).map((line: string) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
            {result.ml_metrics?.pre_route_metrics?.roc_auc != null && (
              <p className="mt-3 font-mono text-[11px] text-mute">
                ML pre-route AUC {result.ml_metrics.pre_route_metrics.roc_auc} · post-route AUC{" "}
                {result.ml_metrics.metrics?.roc_auc ?? "N/A"} (advisory only)
              </p>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {(result.optimize?.routes ?? []).map((route: any) => (
              <div key={route.vehicle_id} className="border border-hairline bg-snow p-3 font-mono text-[12px]">
                <p className="font-semibold">
                  {route.vehicle_id} · {route.driver || "driver"} · load {route.load}/{route.capacity}
                </p>
                <ol className="mt-2 list-decimal pl-4">
                  {(route.stops ?? []).map((s: any) => (
                    <li key={s.order_id}>
                      {s.order_id} · ETA {s.eta_min != null ? `${s.eta_min}m` : "N/A"} · risk{" "}
                      {s.risk?.p_late != null ? s.risk.p_late : "N/A"}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-sans text-[16px] font-semibold">Persisted optimization runs (Firestore)</h2>
        <ul className="mt-3 space-y-2">
          {runsQ.data.slice(0, 8).map((run: any) => (
            <li key={run.id} className="border border-hairline bg-snow px-3 py-2 font-mono text-[12px]">
              {run.mode ?? "run"} · {run.source ?? "—"} · feasible={String(run.feasible)} ·{" "}
              {formatLastSeen(run.createdAt)}
            </li>
          ))}
          {!runsQ.loading && runsQ.data.length === 0 && (
            <li className="font-sans text-[13px] text-mute">No optimizationRuns yet.</li>
          )}
        </ul>
      </section>
    </OpsPageShell>
  );
}
