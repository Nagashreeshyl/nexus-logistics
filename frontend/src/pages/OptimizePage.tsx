import { useMemo, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../firebase/AuthProvider";
import {
  mergeConnection,
  useRealtimeDrivers,
  useRealtimeOrders,
  useRealtimeVehicles,
} from "../hooks/useRealtimeOps";
import { OpsPageShell, MetricGrid } from "../components/ops/OpsPageShell";
import { useToast } from "../components/ops/useToast";
import { getFirebase } from "../firebase/config";
import { assignOrderDelivery } from "../services/firestore/entityCrud";

export function OptimizePage() {
  const { profile, firebaseUser, getIdToken, can } = useAuth();
  const orgId = profile?.organizationId;
  const ordersQ = useRealtimeOrders(orgId);
  const vehiclesQ = useRealtimeVehicles(orgId);
  const driversQ = useRealtimeDrivers(orgId);
  const connection = mergeConnection(ordersQ.connection, vehiclesQ.connection);
  const { show, toastEl } = useToast();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Record<string, any> | null>(null);

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
      const res = await fetch("/api/ops/optimize-live", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || res.statusText);
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
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: firebaseUser.uid,
        });
      }
      show("Optimization complete — result written to Firestore");
    } catch (e) {
      show(e instanceof Error ? e.message : String(e), "err");
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
  const base = result?.baseline?.metrics;

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
          {busy ? "Running…" : "Optimize Deliveries"}
        </button>
      }
    >
      {toastEl}
      <MetricGrid
        items={[
          ["Open orders", openOrders.length],
          ["Available vehicles", availableVehicles.length],
          ["Drivers", driversQ.data.length],
          ["Ready", openOrders.length && availableVehicles.length ? "Yes" : "No"],
        ]}
      />

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
            <h2 className="font-sans text-[18px] font-semibold">AI recommended plan</h2>
            <span className="font-mono text-[12px] text-mute">
              {result.feasible ? "FEASIBLE" : "INFEASIBLE"} · {result.partial ? "PARTIALLY FEASIBLE" : "FULL"}
            </span>
            <button
              type="button"
              disabled={busy}
              className="border border-ink px-3 py-2 font-sans text-[13px] font-semibold"
              onClick={() => void applyPlan()}
            >
              Apply assignments to Firestore
            </button>
          </div>

          <MetricGrid
            items={[
              ["Vehicles used", opt?.vehicles_used ?? "—"],
              ["Distance km", opt?.distance_km ?? "—"],
              ["Late", opt?.late_count ?? "—"],
              ["Deferred", opt?.unassigned_count ?? "—"],
              ["Criticals served", opt?.criticals_served ?? "—"],
              ["Utilization", opt?.capacity_utilization ?? "—"],
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
                    <td className="px-3 py-2">{row.baseline}</td>
                    <td className="px-3 py-2 font-semibold">{row.optimized}</td>
                    <td className="px-3 py-2">{row.delta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border border-hairline bg-snow p-4">
            <p className="sys">Explainability</p>
            <ul className="mt-2 space-y-1 font-sans text-[13px] text-mute">
              {(result.explanations ?? []).map((line: string) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
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
                      {s.order_id} · ETA {s.eta_min}m · risk {s.risk?.p_late ?? "—"}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>

          {base && (
            <p className="font-mono text-[11px] text-mute">
              Baseline late={base.late_count} distance={base.distance_km} · AI late={opt?.late_count} distance=
              {opt?.distance_km}
            </p>
          )}
        </section>
      )}
    </OpsPageShell>
  );
}
