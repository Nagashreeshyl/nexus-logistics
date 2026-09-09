import { useMemo, useState } from "react";
import { useAuth } from "../firebase/AuthProvider";
import {
  mergeConnection,
  useRealtimeDeliveries,
  useRealtimeDrivers,
  useRealtimeExceptions,
  useRealtimeVehicles,
} from "../hooks/useRealtimeOps";
import type { OpsDelivery } from "../lib/opsTypes";
import { isDeliveryStatus } from "../lib/deliveryStatus";
import { LiveSyncBadge, RiskPill, StatusBadge, formatLastSeen } from "../components/ops/OpsBadges";
import { reassignDelivery } from "../services/firestore/operations";
import { Link } from "react-router-dom";

function metricCount(deliveries: OpsDelivery[], status: string) {
  return deliveries.filter((d) => d.status === status).length;
}

export function DispatcherOpsPage() {
  const { profile, firebaseUser } = useAuth();
  const orgId = profile?.organizationId;
  const deliveriesQ = useRealtimeDeliveries(orgId);
  const driversQ = useRealtimeDrivers(orgId);
  const vehiclesQ = useRealtimeVehicles(orgId);
  const exceptionsQ = useRealtimeExceptions(orgId);
  const connection = mergeConnection(
    deliveriesQ.connection,
    driversQ.connection,
    vehiclesQ.connection,
    exceptionsQ.connection,
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const deliveries = useMemo(() => {
    const rows = [...deliveriesQ.data];
    rows.sort((a, b) => String(a.orderId).localeCompare(String(b.orderId)));
    return rows;
  }, [deliveriesQ.data]);

  const atRisk = deliveries.filter((d) => d.riskLevel === "high" || d.riskLevel === "critical").length;
  const activeVehicles = vehiclesQ.data.filter((v) => v.status === "ASSIGNED" || v.availability === "in_use").length;
  const availableVehicles = vehiclesQ.data.filter((v) => v.status === "AVAILABLE" || v.availability === "available").length;
  const openExceptions = exceptionsQ.data.filter((e) => e.status === "open");

  async function onReassign(d: OpsDelivery, driverId: string) {
    if (!firebaseUser || !profile) return;
    const driver = driversQ.data.find((x) => x.id === driverId);
    if (!driver?.userId) {
      setActionError("Selected driver has no linked Firebase userId — cannot reassign securely.");
      return;
    }
    setBusyId(d.id);
    setActionError(null);
    try {
      // Write → Firestore → listeners update UI (no local patch)
      await reassignDelivery({
        delivery: d,
        driverUserId: driver.userId,
        driverId: driver.id,
        driverName: driver.name,
        actorUid: firebaseUser.uid,
        actorEmail: profile.email,
      });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Reassign failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="sys">Dispatcher · realtime</p>
          <h1 className="mt-1 font-sans text-[28px] font-semibold text-ink">Operations board</h1>
          <p className="mt-1 max-w-[62ch] font-sans text-[14px] text-mute">
            Metrics and board derive from Firestore listeners — not hardcoded. Org:{" "}
            <span className="font-mono text-ink">{orgId}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LiveSyncBadge connection={connection} />
          {import.meta.env.DEV && (
            <Link to="/dispatcher/realtime-lab" className="border border-hairline px-3 py-2 font-sans text-[12px] font-semibold">
              Realtime Test Console
            </Link>
          )}
        </div>
      </div>

      {(deliveriesQ.error || actionError) && (
        <p className="mt-4 border border-coral bg-snow px-3 py-2 font-sans text-[13px] text-coral">
          {actionError || deliveriesQ.error}
          {connection !== "live" && connection !== "loading" ? " · Showing last synchronized data if available." : ""}
        </p>
      )}

      <section className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {[
          ["Active", deliveries.filter((d) => !["DELIVERED", "FAILED", "CREATED"].includes(d.status)).length],
          ["Assigned", metricCount(deliveries, "ASSIGNED")],
          ["En route", metricCount(deliveries, "EN_ROUTE")],
          ["Arrived", metricCount(deliveries, "ARRIVED")],
          ["Delivered", metricCount(deliveries, "DELIVERED")],
          ["Failed", metricCount(deliveries, "FAILED")],
          ["At risk", atRisk],
          ["Vehicles active", activeVehicles],
          ["Vehicles available", availableVehicles],
          ["Open exceptions", openExceptions.length],
        ].map(([label, value]) => (
          <div key={String(label)} className="border border-hairline bg-snow px-3 py-3">
            <p className="sys">{label}</p>
            <p className="mt-1 font-mono text-[22px] font-semibold tabular text-ink">
              {deliveriesQ.loading && deliveries.length === 0 ? "…" : value}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="font-sans text-[18px] font-semibold">Live delivery board</h2>
        <div className="mt-3 overflow-x-auto border border-hairline bg-snow">
          <table className="min-w-full text-left font-mono text-[12px]">
            <thead className="border-b border-hairline bg-paper text-mute">
              <tr>
                {["Order", "Customer", "Destination", "Driver", "Vehicle", "Status", "Window", "ETA", "Risk", "Updated", "Reassign"].map(
                  (h) => (
                    <th key={h} className="px-3 py-2 font-semibold">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {deliveries.length === 0 && !deliveriesQ.loading && (
                <tr>
                  <td colSpan={11} className="px-3 py-8 text-center text-mute">
                    No deliveries yet. Open Realtime Test Console (dev) to seed synthetic Firestore data.
                  </td>
                </tr>
              )}
              {deliveries.map((d) => (
                <tr key={d.id} className="border-b border-hairline/80 align-top">
                  <td className="px-3 py-2 font-semibold text-ink">{d.orderId}</td>
                  <td className="px-3 py-2">{d.customerName ?? "—"}</td>
                  <td className="max-w-[180px] px-3 py-2 text-mute">{d.destination ?? "—"}</td>
                  <td className="px-3 py-2">{d.driverName ?? "—"}</td>
                  <td className="px-3 py-2">{d.vehicleLabel ?? d.vehicleId ?? "—"}</td>
                  <td className="px-3 py-2">
                    {isDeliveryStatus(d.status) ? <StatusBadge status={d.status} /> : d.status}
                    {d.exceptionOpen ? <span className="ml-1 text-coral">ex</span> : null}
                  </td>
                  <td className="px-3 py-2">
                    {d.windowStart ?? "?"}–{d.windowEnd ?? "?"}
                  </td>
                  <td className="px-3 py-2 tabular">{d.etaMin != null ? `${d.etaMin}m` : "—"}</td>
                  <td className="px-3 py-2">
                    <RiskPill level={d.riskLevel} />
                  </td>
                  <td className="px-3 py-2 text-mute">{formatLastSeen(d.updatedAt)}</td>
                  <td className="px-3 py-2">
                    <select
                      className="max-w-[140px] border border-hairline bg-paper px-1 py-1"
                      disabled={busyId === d.id}
                      defaultValue=""
                      onChange={(e) => {
                        const v = e.target.value;
                        e.target.value = "";
                        if (v) void onReassign(d, v);
                      }}
                    >
                      <option value="">Driver…</option>
                      {driversQ.data
                        .filter((dr) => dr.userId)
                        .map((dr) => (
                          <option key={dr.id} value={dr.id}>
                            {dr.name}
                          </option>
                        ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-sans text-[18px] font-semibold">Exceptions</h2>
        <ul className="mt-3 space-y-2">
          {openExceptions.length === 0 && (
            <li className="border border-hairline bg-snow px-3 py-4 font-sans text-[13px] text-mute">No open exceptions.</li>
          )}
          {openExceptions.map((ex) => (
            <li key={ex.id} className="border border-hairline bg-snow px-3 py-3 font-mono text-[12px]">
              <span className="font-semibold text-coral">{ex.type}</span> · {ex.severity} · {ex.message}
              {ex.deliveryId ? <span className="text-mute"> · delivery {ex.deliveryId}</span> : null}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
