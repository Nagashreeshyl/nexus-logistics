import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../firebase/AuthProvider";
import { useRealtimeDeliveries, useRealtimeDrivers, useRealtimeExceptions } from "../hooks/useRealtimeOps";
import { LiveSyncBadge, StatusBadge } from "../components/ops/OpsBadges";
import { createException, transitionDeliveryStatus } from "../services/firestore/operations";
import { seedRealtimeDemo } from "../services/firestore/seedRealtimeDemo";
import type { OpsDelivery } from "../lib/opsTypes";
import { nextPrimaryTransition } from "../lib/deliveryStatus";

/**
 * Dev/demo only: every button writes to Firestore.
 * Visible UI updates must arrive via listeners on dispatcher/driver pages.
 */
export function RealtimeTestConsolePage() {
  const { profile, firebaseUser } = useAuth();
  const orgId = profile?.organizationId;
  const deliveriesQ = useRealtimeDeliveries(orgId);
  const driversQ = useRealtimeDrivers(orgId);
  const exceptionsQ = useRealtimeExceptions(orgId);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const deliveries = useMemo(() => [...deliveriesQ.data].sort((a, b) => a.orderId.localeCompare(b.orderId)), [deliveriesQ.data]);

  function pushLog(msg: string) {
    setLog((prev) => [`${new Date().toLocaleTimeString()} · ${msg}`, ...prev].slice(0, 40));
  }

  async function run(label: string, fn: () => Promise<void>) {
    if (!firebaseUser || !profile || !orgId) return;
    setBusy(true);
    try {
      await fn();
      pushLog(`${label} — Firestore write OK (wait for listener)`);
    } catch (e) {
      pushLog(`${label} FAILED: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  if (!import.meta.env.DEV) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 font-sans">
        <h1 className="text-[22px] font-semibold">Realtime Test Console</h1>
        <p className="mt-2 text-mute">Available only in development builds.</p>
        <Link className="mt-4 inline-block underline" to="/dispatcher">
          Back
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[960px] px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="sys">Dev · Firestore writes only</p>
          <h1 className="font-sans text-[24px] font-semibold">Realtime Test Console</h1>
          <p className="mt-1 font-sans text-[13px] text-mute">
            Button → Firestore write → listener → UI. Do not open two tabs of this console expecting local state sync —
            open Dispatcher + Driver dashboards.
          </p>
        </div>
        <LiveSyncBadge connection={deliveriesQ.connection} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          className="bg-coral px-3 py-2 font-sans text-[13px] font-semibold disabled:opacity-40"
          onClick={() =>
            void run("Seed demo", async () => {
              const alt = driversQ.data.find((d) => d.userId && d.userId !== firebaseUser!.uid)?.userId;
              await seedRealtimeDemo({
                organizationId: orgId!,
                actorUid: firebaseUser!.uid,
                actorEmail: profile!.email,
                altDriverUserId: alt ?? null,
              });
            })
          }
        >
          Seed synthetic deliveries
        </button>
        <Link to="/dispatcher" className="border border-hairline px-3 py-2 font-sans text-[13px] font-semibold">
          Open dispatcher board
        </Link>
        <Link to="/driver" className="border border-hairline px-3 py-2 font-sans text-[13px] font-semibold">
          Open driver route
        </Link>
      </div>

      <section className="mt-6 border border-hairline bg-snow">
        <table className="min-w-full font-mono text-[12px]">
          <thead className="border-b border-hairline text-mute">
            <tr>
              <th className="px-3 py-2 text-left">Order</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Driver</th>
              <th className="px-3 py-2 text-left">Actions (Firestore writes)</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((d: OpsDelivery) => {
              const next = nextPrimaryTransition(d.status);
              return (
                <tr key={d.id} className="border-b border-hairline/70">
                  <td className="px-3 py-2">{d.orderId}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-3 py-2">{d.driverName ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {next && (
                        <button
                          type="button"
                          disabled={busy}
                          className="border border-ink px-2 py-1"
                          onClick={() =>
                            void run(`${d.orderId}→${next}`, () =>
                              transitionDeliveryStatus({
                                delivery: d,
                                to: next,
                                actorUid: firebaseUser!.uid,
                                actorEmail: profile!.email,
                              }),
                            )
                          }
                        >
                          → {next}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        className="border border-hairline px-2 py-1"
                        onClick={() =>
                          void run(`exception ${d.orderId}`, () =>
                            createException({
                              organizationId: orgId!,
                              type: "LATE_RISK",
                              severity: "high",
                              message: `Demo exception for ${d.orderId}`,
                              deliveryId: d.id,
                              orderId: d.orderId,
                              actorUid: firebaseUser!.uid,
                              actorEmail: profile!.email,
                              notifyUserIds: [firebaseUser!.uid],
                              synthetic: true,
                            }).then(() => undefined),
                          )
                        }
                      >
                        Exception
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="border border-hairline bg-snow p-3">
          <p className="sys">Listener snapshot</p>
          <p className="mt-2 font-mono text-[12px]">
            deliveries={deliveries.length} · drivers={driversQ.data.length} · exceptions={exceptionsQ.data.length}
          </p>
        </div>
        <div className="border border-hairline bg-snow p-3">
          <p className="sys">Write log</p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-auto font-mono text-[11px] text-mute">
            {log.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
