import { useMemo, useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../firebase/AuthProvider";
import {
  mergeConnection,
  useRealtimeDeliveries,
  useRealtimeDrivers,
  useRealtimeExceptions,
  useRealtimeOrders,
  useRealtimeVehicles,
} from "../hooks/useRealtimeOps";
import { OpsPageShell, MetricGrid } from "../components/ops/OpsPageShell";
import { StatusBadge, formatLastSeen } from "../components/ops/OpsBadges";
import { useToast } from "../components/ops/useToast";
import { assignOrderDelivery, updateVehicle } from "../services/firestore/entityCrud";
import { getFirebase } from "../firebase/config";
import { apiUrl } from "../lib/apiUrl";

function metric(v: unknown): string | number {
  if (v === null || v === undefined || Number.isNaN(v)) return "N/A";
  return v as string | number;
}

/**
 * Exception center + breakdown-triggered live reoptimization (OR-Tools hard constraints).
 */
export function ExceptionsPage() {
  const { profile, firebaseUser, can, getIdToken } = useAuth();
  const orgId = profile?.organizationId;
  const exceptionsQ = useRealtimeExceptions(orgId);
  const vehiclesQ = useRealtimeVehicles(orgId);
  const deliveriesQ = useRealtimeDeliveries(orgId);
  const ordersQ = useRealtimeOrders(orgId);
  const driversQ = useRealtimeDrivers(orgId);
  const connection = mergeConnection(exceptionsQ.connection, vehiclesQ.connection, ordersQ.connection);
  const { show, toastEl } = useToast();
  const [busy, setBusy] = useState(false);
  const [reopt, setReopt] = useState<Record<string, any> | null>(null);

  const open = useMemo(() => exceptionsQ.data.filter((e) => e.status === "open"), [exceptionsQ.data]);
  const actor = { uid: firebaseUser?.uid ?? "", email: profile?.email ?? "", organizationId: orgId ?? "" };
  const canWrite = can("manage_exceptions") || can("manage_fleet");

  async function runLiveReopt(brokenVehicleId: string, affectedOrderIds: string[]) {
    const token = await getIdToken();
    if (!token) throw new Error("Missing Firebase ID token");
    if (!orgId) throw new Error("Missing organization");

    const survivingVehicles = vehiclesQ.data.filter(
      (v) =>
        v.id !== brokenVehicleId &&
        v.active !== false &&
        !["INACTIVE", "BREAKDOWN", "MAINTENANCE"].includes(String(v.status)),
    );
    const orderIds = new Set(
      [
        ...affectedOrderIds,
        ...ordersQ.data
          .filter((o) => !["COMPLETED", "CANCELLED", "FAILED"].includes(String(o.status)))
          .map((o) => o.id),
      ].filter(Boolean),
    );
    const orders = ordersQ.data.filter((o) => orderIds.has(o.id));
    if (!orders.length) throw new Error("No open orders available to reoptimize");
    if (!survivingVehicles.length) throw new Error("No surviving vehicles available for reoptimization");

    const payload = {
      organization_id: orgId,
      orders: orders.map((o) => ({
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
      vehicles: survivingVehicles.map((v) => {
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

    const fb = getFirebase();
    if (fb.configured && firebaseUser) {
      await addDoc(collection(fb.db, "optimizationRuns"), {
        organizationId: orgId,
        mode: "reoptimize-breakdown",
        source: "exception-center",
        brokenVehicleId,
        affectedOrderIds,
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

    return data;
  }

  async function markBreakdown(vehicleId: string) {
    if (!canWrite || busy) return;
    setBusy(true);
    try {
      await updateVehicle(actor, vehicleId, { status: "BREAKDOWN" });
      const vehicle = vehiclesQ.data.find((v) => v.id === vehicleId);
      const affected = deliveriesQ.data.filter(
        (d) => d.vehicleId === vehicleId && !["DELIVERED", "FAILED"].includes(d.status),
      );
      const affectedOrderIds = affected.map((d) => d.orderId).filter(Boolean);
      const fb = getFirebase();
      if (fb.configured && orgId && firebaseUser) {
        await addDoc(collection(fb.db, "exceptions"), {
          organizationId: orgId,
          type: "VEHICLE_BREAKDOWN",
          severity: "HIGH",
          status: "open",
          vehicleId,
          message: `Vehicle ${vehicle?.registrationNumber ?? vehicleId} marked BREAKDOWN`,
          affectedOrderIds,
          synthetic: vehicle?.synthetic === true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: firebaseUser.uid,
        });
      }
      show(`Breakdown recorded · ${affected.length} deliveries affected`);
      setReopt({
        kind: "breakdown-pending-reopt",
        brokenVehicleId: vehicleId,
        affectedOrderIds,
        note: "Vehicle marked BREAKDOWN in Firestore. Click Reoptimize to compute a new feasible plan excluding this vehicle.",
      });
    } catch (e) {
      show(e instanceof Error ? e.message : String(e), "err");
    } finally {
      setBusy(false);
    }
  }

  async function reoptimize() {
    if (busy) return;
    if (!reopt?.brokenVehicleId || !canWrite) return;
    setBusy(true);
    try {
      const data = await runLiveReopt(reopt.brokenVehicleId, reopt.affectedOrderIds ?? []);
      setReopt({
        ...reopt,
        kind: "live-reopt",
        before: data.baseline?.metrics,
        after: data.optimize?.metrics,
        comparison: data.comparison,
        optimize: data.optimize,
        feasible: data.feasible,
        partial: data.partial,
        note: "Live OR-Tools reoptimization excluding the broken vehicle. Review Before/After, then Approve plan to write assignments.",
      });
      show("Reoptimization complete. Review before and after");
    } catch (e) {
      show(e instanceof Error ? e.message : String(e), "err");
    } finally {
      setBusy(false);
    }
  }

  async function approvePlan() {
    if (busy) return;
    if (!reopt?.optimize || !firebaseUser || !profile || !orgId) return;
    setBusy(true);
    try {
      for (const route of reopt.optimize.routes ?? []) {
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
      show("Plan approved. Assignments written to Firestore");
    } catch (e) {
      show(e instanceof Error ? e.message : String(e), "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <OpsPageShell
      title="Exception Center"
      subtitle="Disruptions create exceptions. Reoptimization uses OR-Tools hard constraints and never LLM routing."
      connection={connection}
      actions={
        reopt?.brokenVehicleId && canWrite ? (
          <button
            type="button"
            disabled={busy}
            className="bg-coral px-4 py-2 font-sans text-[13px] font-semibold disabled:opacity-40"
            onClick={() => void reoptimize()}
          >
            {busy ? "Working…" : "Reoptimize"}
          </button>
        ) : null
      }
    >
      {toastEl}
      <section className="mt-6 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-ink bg-ink p-5 text-snow">
          <p className="font-sans text-[12px] font-medium uppercase tracking-[0.08em] text-snow/70">Recovery flow</p>
          <ol className="mt-3 space-y-3 font-sans text-[14px] leading-6 text-snow/80">
            <li>1. Mark the blocked vehicle or delivery issue.</li>
            <li>2. Review the proposed before / after plan.</li>
            <li>3. Approve only after the impact looks feasible.</li>
          </ol>
        </div>
        <div className="rounded-2xl border border-hairline bg-snow p-5">
          <p className="font-sans text-[12px] font-medium uppercase tracking-[0.08em] text-mute">Current reoptimization</p>
          <p className="mt-2 font-sans text-[18px] font-semibold text-ink">
            {reopt?.brokenVehicleId ? `Vehicle ${reopt.brokenVehicleId.slice(0, 8)}` : "No active disruption selected"}
          </p>
          <p className="mt-2 font-sans text-[13px] leading-6 text-mute">
            Use this page for exceptions only. Normal assignments should stay in Operations or Optimize.
          </p>
        </div>
      </section>

      {exceptionsQ.loading && <p className="mt-4 font-sans text-[13px] text-mute">Loading exceptions…</p>}
      {exceptionsQ.error && (
        <p className="mt-4 border border-coral bg-snow px-3 py-2 font-sans text-[13px] text-coral">{exceptionsQ.error}</p>
      )}
      {connection === "permission_denied" && (
        <p className="mt-4 border border-coral bg-snow px-3 py-2 font-sans text-[13px] text-coral">
          Permission denied. Unable to synchronize exceptions.
        </p>
      )}
      {(connection === "offline" || connection === "error") && (
        <p className="mt-4 border border-hairline bg-snow px-3 py-2 font-sans text-[13px] text-mute">
          Connection issue. Unable to synchronize. Do not treat this board as live.
        </p>
      )}

      <MetricGrid
        items={[
          ["Open", open.length],
          ["Total", exceptionsQ.data.length],
          ["Vehicles", vehiclesQ.data.length],
          ["Active deliveries", deliveriesQ.data.filter((d) => !["DELIVERED", "FAILED"].includes(d.status)).length],
        ]}
      />

      <section className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-sans text-[18px] font-semibold">Mark vehicle breakdown</h2>
            <p className="mt-1 font-sans text-[13px] text-mute">Pick the vehicle that is blocked right now. This creates an exception record and prepares a reoptimization draft.</p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {vehiclesQ.data.length === 0 && !vehiclesQ.loading && (
            <p className="font-sans text-[13px] text-mute">No vehicles. Generate a demo scenario first.</p>
          )}
          {vehiclesQ.data.map((v) => (
            <button
              key={v.id}
              type="button"
              disabled={busy || !canWrite || v.status === "BREAKDOWN"}
              className="rounded-xl border border-hairline px-3 py-2 font-mono text-[12px] disabled:opacity-40"
              onClick={() => void markBreakdown(v.id)}
            >
              {v.registrationNumber ?? v.id.slice(0, 6)} · {v.status}
            </button>
          ))}
        </div>
      </section>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-hairline bg-snow">
        <table className="min-w-full font-mono text-[12px]">
          <thead className="border-b border-hairline bg-paper text-mute">
            <tr>
              {["Type", "Severity", "Message", "Vehicle", "Order", "Status", "Created"].map((h) => (
                <th key={h} className="px-3 py-2 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {exceptionsQ.data.map((ex) => (
              <tr key={ex.id} className="border-b border-hairline/70">
                <td className="px-3 py-2 font-semibold text-coral">{ex.type}</td>
                <td className="px-3 py-2">{ex.severity}</td>
                <td className="max-w-[280px] px-3 py-2">{ex.message}</td>
                <td className="px-3 py-2">{ex.vehicleId?.slice(0, 8) ?? "N/A"}</td>
                <td className="px-3 py-2">{ex.orderId ?? "N/A"}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={String(ex.status)} />
                </td>
                <td className="px-3 py-2 text-mute">{formatLastSeen(ex.createdAt)}</td>
              </tr>
            ))}
            {!exceptionsQ.loading && exceptionsQ.data.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-mute">
                  No exceptions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {reopt && (
        <section className="mt-8 border border-hairline bg-snow p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-sans text-[18px] font-semibold">Before / after reoptimization</h2>
              <p className="mt-1 font-sans text-[13px] text-mute">Check the tradeoffs before writing a new plan to Firestore.</p>
            </div>
            {reopt.optimize && canWrite && (
              <button
                type="button"
                disabled={busy}
                className="rounded-xl border border-ink px-4 py-2 font-sans text-[13px] font-semibold disabled:opacity-40"
                onClick={() => void approvePlan()}
              >
                Approve plan
              </button>
            )}
          </div>
          <p className="mt-1 font-sans text-[13px] text-mute">{reopt.note}</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl bg-paper px-3 py-3 font-mono text-[12px]">Broken vehicle: {reopt.brokenVehicleId}</div>
            <div className="rounded-xl bg-paper px-3 py-3 font-mono text-[12px]">Affected orders: {(reopt.affectedOrderIds ?? []).join(", ") || "none"}</div>
          </div>
          {reopt.comparison ? (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full font-mono text-[12px]">
                <thead>
                  <tr className="text-mute">
                    <th className="px-2 py-1 text-left">Metric</th>
                    <th className="px-2 py-1 text-left">Before</th>
                    <th className="px-2 py-1 text-left">After</th>
                  </tr>
                </thead>
                <tbody>
                  {(reopt.comparison ?? []).slice(0, 8).map((row: any) => (
                    <tr key={row.key}>
                      <td className="px-2 py-1">{row.metric}</td>
                      <td className="px-2 py-1">{metric(row.baseline)}</td>
                      <td className="px-2 py-1 font-semibold">{metric(row.optimized)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 font-sans text-[13px] text-mute">Click Reoptimize to compute a new plan.</p>
          )}
        </section>
      )}
    </OpsPageShell>
  );
}
