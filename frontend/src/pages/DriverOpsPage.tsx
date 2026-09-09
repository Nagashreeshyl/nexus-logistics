import { useMemo, useRef, useState } from "react";
import { useAuth } from "../firebase/AuthProvider";
import { mergeConnection, useRealtimeDeliveries } from "../hooks/useRealtimeOps";
import { nextPrimaryTransition, DELIVERY_STATUS_LABEL, type DeliveryStatus } from "../lib/deliveryStatus";
import type { OpsDelivery } from "../lib/opsTypes";
import { LiveSyncBadge, RiskPill, StatusBadge, formatLastSeen } from "../components/ops/OpsBadges";
import { transitionDeliveryStatus } from "../services/firestore/operations";
import { DriverRouteMap } from "../components/ops/DriverRouteMap";

const PRIMARY_LABEL: Partial<Record<DeliveryStatus, string>> = {
  EN_ROUTE: "Start Delivery",
  ARRIVED: "Arrived",
  DELIVERED: "Complete",
};

export function DriverOpsPage() {
  const { profile, firebaseUser } = useAuth();
  const orgId = profile?.organizationId;
  const uid = firebaseUser?.uid;
  const deliveriesQ = useRealtimeDeliveries(orgId);
  const connection = mergeConnection(deliveriesQ.connection);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const liveDeliveriesRef = useRef(deliveriesQ.data);
  liveDeliveriesRef.current = deliveriesQ.data;

  const mine = useMemo(() => {
    const rows = deliveriesQ.data.filter((d) => d.driverUserId === uid);
    rows.sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
    return rows;
  }, [deliveriesQ.data, uid]);

  async function advance(d: OpsDelivery) {
    if (!firebaseUser || !profile) return;
    // Use live status from current list (avoid stale closure after listener updates).
    const live = mine.find((x) => x.id === d.id) ?? d;
    const to = nextPrimaryTransition(live.status);
    if (!to) return;
    setBusyId(live.id);
    setError(null);
    const started = performance.now();
    try {
      await transitionDeliveryStatus({
        delivery: live,
        to,
        actorUid: firebaseUser.uid,
        actorEmail: profile.email,
        notifyUserIds: [firebaseUser.uid],
      });
      console.info(
        `[realtime] delivery ${live.id} ${live.status}→${to} write_ms=${Math.round(performance.now() - started)}`,
      );
    } catch (e) {
      // Server write may have landed while the client ack timed out — trust live listener.
      await new Promise((r) => window.setTimeout(r, 400));
      const after = liveDeliveriesRef.current.find((x) => x.id === live.id);
      if (after?.status === to) {
        console.info(
          `[realtime] delivery ${live.id} ack slow but listener shows ${to} (${Math.round(performance.now() - started)}ms)`,
        );
      } else {
        setError(e instanceof Error ? e.message : "Update failed");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function fail(d: OpsDelivery) {
    if (!firebaseUser || !profile) return;
    setBusyId(d.id);
    setError(null);
    try {
      await transitionDeliveryStatus({
        delivery: d,
        to: "FAILED",
        actorUid: firebaseUser.uid,
        actorEmail: profile.email,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fail update failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto max-w-[960px] px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="sys">Driver · realtime</p>
          <h1 className="mt-1 font-sans text-[28px] font-semibold">Today&apos;s route</h1>
          <p className="mt-1 font-sans text-[14px] text-mute">
            Only deliveries assigned to your Firebase UID. Updates write to Firestore; the dispatcher board listens.
          </p>
        </div>
        <LiveSyncBadge connection={connection} />
      </div>

      {deliveriesQ.loading && (
        <p className="mt-4 font-sans text-[13px] text-mute">Synchronizing deliveries…</p>
      )}
      {(connection === "offline" || connection === "error") && (
        <p className="mt-4 border border-hairline bg-snow px-3 py-2 font-sans text-[13px] text-mute">
          Connection issue — unable to synchronize. Do not treat this route as live.
        </p>
      )}
      {connection === "permission_denied" && (
        <p className="mt-4 border border-coral bg-snow px-3 py-2 font-sans text-[13px] text-coral">
          Permission denied — unable to load your deliveries.
        </p>
      )}

      {(error || deliveriesQ.error) && (
        <p className="mt-4 border border-coral bg-snow px-3 py-2 font-sans text-[13px] text-coral">
          {error || deliveriesQ.error}
        </p>
      )}

      <DriverRouteMap
        deliveries={mine}
        driverLocation={
          mine[0]?.lastLocation
            ? { lat: mine[0].lastLocation.lat, lon: mine[0].lastLocation.lon, synthetic: mine[0].lastLocation.synthetic }
            : { lat: 12.9716, lon: 77.5946, synthetic: true }
        }
      />

      <ol className="mt-6 space-y-3">
        {mine.length === 0 && !deliveriesQ.loading && (
          <li className="border border-hairline bg-snow px-4 py-8 text-center font-sans text-[14px] text-mute">
            No assigned deliveries for your user. Seed from Dispatcher → Realtime Test Console, or ask dispatcher to
            reassign to you.
          </li>
        )}
        {mine.map((d, idx) => {
          const next = nextPrimaryTransition(d.status);
          return (
            <li key={d.id} className="border border-hairline bg-snow p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] font-semibold text-mute">
                    #{idx + 1} · {d.orderId} · seq {d.sequence ?? "—"}
                  </p>
                  <h2 className="mt-1 font-sans text-[18px] font-semibold">{d.customerName ?? "Customer"}</h2>
                  <p className="mt-1 font-sans text-[14px] text-mute">{d.destination ?? "—"}</p>
                  <div className="mt-3 flex flex-wrap gap-3 font-mono text-[12px]">
                    <StatusBadge status={d.status} />
                    <span>
                      Window {d.windowStart ?? "?"}–{d.windowEnd ?? "?"}
                    </span>
                    <span>ETA {d.etaMin != null ? `${d.etaMin}m` : "—"}</span>
                    <span>
                      Risk <RiskPill level={d.riskLevel} />
                    </span>
                    <span className="text-mute">Updated {formatLastSeen(d.updatedAt)}</span>
                  </div>
                  {d.lastLocation && (
                    <p className="mt-2 font-mono text-[11px] text-mute">
                      Location {d.lastLocation.lat.toFixed(4)}, {d.lastLocation.lon.toFixed(4)}
                      {d.lastLocation.synthetic ? " · synthetic/demo" : ""}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {next && (
                    <button
                      type="button"
                      disabled={busyId === d.id}
                      onClick={() => void advance(d)}
                      className="bg-coral px-4 py-2 font-sans text-[13px] font-semibold text-ink disabled:opacity-40"
                    >
                      {busyId === d.id ? "Writing…" : PRIMARY_LABEL[next] ?? DELIVERY_STATUS_LABEL[next]}
                    </button>
                  )}
                  {d.status !== "DELIVERED" && d.status !== "FAILED" && (
                    <button
                      type="button"
                      disabled={busyId === d.id}
                      onClick={() => void fail(d)}
                      className="border border-hairline px-4 py-2 font-sans text-[13px] font-semibold disabled:opacity-40"
                    >
                      Mark failed
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
