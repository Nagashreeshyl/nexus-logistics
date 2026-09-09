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
  const active = mine.find((d) => d.status !== "DELIVERED" && d.status !== "FAILED") ?? null;
  const completedCount = mine.filter((d) => d.status === "DELIVERED").length;

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
      <div className="rounded-2xl border border-hairline bg-snow p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="sys text-coral">Driver workspace</p>
            <h1 className="mt-2 font-sans text-[30px] font-semibold tracking-[-0.02em]">Today&apos;s route</h1>
            <p className="mt-2 max-w-[64ch] font-sans text-[14px] leading-6 text-mute">
              Follow one clear next step at a time. Your updates write to Firestore and should appear in the dispatcher board automatically.
            </p>
          </div>
          <LiveSyncBadge connection={connection} />
        </div>
      </div>

      <section className="mt-6 grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-hairline bg-snow px-4 py-4">
          <p className="font-sans text-[12px] font-medium uppercase tracking-[0.08em] text-mute">Assigned</p>
          <p className="mt-2 font-mono text-[22px] font-semibold">{mine.length}</p>
        </div>
        <div className="rounded-xl border border-hairline bg-snow px-4 py-4">
          <p className="font-sans text-[12px] font-medium uppercase tracking-[0.08em] text-mute">Completed</p>
          <p className="mt-2 font-mono text-[22px] font-semibold">{completedCount}</p>
        </div>
        <div className="rounded-xl border border-hairline bg-snow px-4 py-4">
          <p className="font-sans text-[12px] font-medium uppercase tracking-[0.08em] text-mute">Next stop</p>
          <p className="mt-2 font-sans text-[15px] font-semibold">{active?.customerName ?? "Waiting for assignment"}</p>
        </div>
        <div className="rounded-xl border border-hairline bg-snow px-4 py-4">
          <p className="font-sans text-[12px] font-medium uppercase tracking-[0.08em] text-mute">Current status</p>
          <div className="mt-2">{active ? <StatusBadge status={active.status} /> : <span className="font-sans text-[14px] text-mute">No active stop</span>}</div>
        </div>
      </section>

      {active && (
        <section className="mt-6 rounded-2xl border border-ink bg-ink p-5 text-snow">
          <p className="font-sans text-[12px] font-medium uppercase tracking-[0.08em] text-snow/70">Do this next</p>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="font-sans text-[22px] font-semibold">{active.customerName ?? active.orderId}</h2>
              <p className="mt-1 font-sans text-[14px] text-snow/75">{active.destination ?? "Destination pending"}</p>
              <div className="mt-3 flex flex-wrap gap-3 font-mono text-[12px] text-snow/75">
                <span>Window {active.windowStart ?? "?"}-{active.windowEnd ?? "?"}</span>
                <span>ETA {active.etaMin != null ? `${active.etaMin}m` : "N/A"}</span>
                <span>Order {active.orderId}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {nextPrimaryTransition(active.status) && (
                <button
                  type="button"
                  disabled={busyId === active.id}
                  onClick={() => void advance(active)}
                  className="rounded-xl bg-coral px-4 py-3 font-sans text-[14px] font-semibold text-ink disabled:opacity-40"
                >
                  {busyId === active.id
                    ? "Writing…"
                    : PRIMARY_LABEL[nextPrimaryTransition(active.status)!] ?? DELIVERY_STATUS_LABEL[nextPrimaryTransition(active.status)!]}
                </button>
              )}
              {active.status !== "DELIVERED" && active.status !== "FAILED" && (
                <button
                  type="button"
                  disabled={busyId === active.id}
                  onClick={() => void fail(active)}
                  className="rounded-xl border border-snow/20 px-4 py-3 font-sans text-[14px] font-semibold text-snow disabled:opacity-40"
                >
                  Mark failed
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-sans text-[16px] font-semibold text-ink">Route map and stop list</p>
          <p className="mt-1 font-sans text-[13px] text-mute">
            Review the full sequence below if you need context before moving to the next stop.
          </p>
        </div>
        <LiveSyncBadge connection={connection} />
      </div>

      {deliveriesQ.loading && (
        <p className="mt-4 font-sans text-[13px] text-mute">Synchronizing deliveries…</p>
      )}
      {(connection === "offline" || connection === "error") && (
        <p className="mt-4 border border-hairline bg-snow px-3 py-2 font-sans text-[13px] text-mute">
          Connection issue. Unable to synchronize. Do not treat this route as live.
        </p>
      )}
      {connection === "permission_denied" && (
        <p className="mt-4 border border-coral bg-snow px-3 py-2 font-sans text-[13px] text-coral">
          Permission denied. Unable to load your deliveries.
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
          <li className="rounded-2xl border border-hairline bg-snow px-4 py-8 text-center font-sans text-[14px] text-mute">
            No assigned deliveries for your user. Seed from Dispatcher → Realtime Test Console, or ask dispatcher to
            reassign to you.
          </li>
        )}
        {mine.map((d, idx) => {
          const next = nextPrimaryTransition(d.status);
          return (
            <li key={d.id} className={`rounded-2xl border p-4 ${active?.id === d.id ? "border-ink bg-paper" : "border-hairline bg-snow"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] font-semibold text-mute">
                    #{idx + 1} · {d.orderId} · seq {d.sequence ?? "N/A"}
                  </p>
                  <h2 className="mt-1 font-sans text-[18px] font-semibold">{d.customerName ?? "Customer"}</h2>
                  <p className="mt-1 font-sans text-[14px] text-mute">{d.destination ?? "N/A"}</p>
                  <div className="mt-3 flex flex-wrap gap-3 font-mono text-[12px]">
                    <StatusBadge status={d.status} />
                    <span>
                      Window {d.windowStart ?? "?"}-{d.windowEnd ?? "?"}
                    </span>
                    <span>ETA {d.etaMin != null ? `${d.etaMin}m` : "N/A"}</span>
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
