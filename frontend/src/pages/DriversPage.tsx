import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../firebase/AuthProvider";
import {
  mergeConnection,
  useRealtimeDeliveries,
  useRealtimeDrivers,
  useRealtimeVehicles,
} from "../hooks/useRealtimeOps";
import { MetricGrid, OpsPageShell, SearchFilterBar, SyntheticBadge } from "../components/ops/OpsPageShell";
import { StatusBadge, formatLastSeen } from "../components/ops/OpsBadges";
import { useToast } from "../components/ops/useToast";
import {
  assignDriverVehicle,
  deactivateDriver,
  generateSyntheticDriver,
  unassignDriverVehicle,
  updateDriver,
} from "../services/firestore/entityCrud";
import { DRIVER_STATUSES } from "../lib/opsEnums";

export function DriversPage({ readOnly = false, basePath = "/admin/drivers" }: { readOnly?: boolean; basePath?: string }) {
  const { profile, firebaseUser, can } = useAuth();
  const orgId = profile?.organizationId;
  const driversQ = useRealtimeDrivers(orgId);
  const vehiclesQ = useRealtimeVehicles(orgId);
  const deliveriesQ = useRealtimeDeliveries(orgId);
  const connection = mergeConnection(driversQ.connection, vehiclesQ.connection);
  const { show, toastEl } = useToast();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const canWrite = !readOnly && can("manage_fleet");
  const actor = { uid: firebaseUser?.uid ?? "", email: profile?.email ?? "", organizationId: orgId ?? "" };

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    return driversQ.data
      .filter((d) => !q || `${d.name} ${d.phone ?? ""} ${d.id}`.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [driversQ.data, search]);

  const metrics = useMemo(() => {
    const all = driversQ.data;
    const c = (s: string) => all.filter((d) => d.status === s).length;
    return [
      ["Total", all.length],
      ["Available", c("AVAILABLE")],
      ["Assigned", c("ASSIGNED")],
      ["On route", c("ON_ROUTE")],
      ["Off duty", c("OFF_DUTY")],
      ["Unavailable", c("UNAVAILABLE")],
    ] as Array<[string, number | string]>;
  }, [driversQ.data]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      show(`${label} OK`);
    } catch (e) {
      show(e instanceof Error ? e.message : String(e), "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <OpsPageShell
      title="Drivers"
      subtitle="Operational driver management — not HR. Live from Firestore."
      connection={connection}
      actions={
        canWrite ? (
          <button
            type="button"
            disabled={busy}
            className="bg-coral px-3 py-2 font-sans text-[13px] font-semibold disabled:opacity-40"
            onClick={() =>
              void run("Synthetic driver", () =>
                generateSyntheticDriver(actor, firebaseUser?.uid).then(() => undefined),
              )
            }
          >
            Generate Synthetic
          </button>
        ) : null
      }
    >
      {toastEl}
      <MetricGrid items={metrics} />
      <SearchFilterBar search={search} onSearch={setSearch} placeholder="Search name / phone" />
      <div className="mt-4 overflow-x-auto border border-hairline bg-snow">
        <table className="min-w-full text-left font-mono text-[12px]">
          <thead className="border-b border-hairline bg-paper text-mute">
            <tr>
              {["Driver", "Phone", "Status", "Vehicle", "Shift", "Today", "Updated", "Actions"].map((h) => (
                <th key={h} className="px-3 py-2">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const today = deliveriesQ.data.filter((x) => x.driverId === d.id || x.driverUserId === d.userId);
              const done = today.filter((x) => x.status === "DELIVERED").length;
              const vehicle = vehiclesQ.data.find((v) => v.id === d.assignedVehicleId);
              return (
                <tr key={d.id} className="border-b border-hairline/70 align-top">
                  <td className="px-3 py-2">
                    <Link className="font-semibold underline" to={`${basePath}/${d.id}`}>
                      {d.name}
                    </Link>
                    <SyntheticBadge synthetic={d.synthetic} dataSource={d.dataSource} />
                    {d.active === false ? <span className="ml-1 text-coral">inactive</span> : null}
                  </td>
                  <td className="px-3 py-2">{d.phone || "—"}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={String(d.status ?? "AVAILABLE")} />
                  </td>
                  <td className="px-3 py-2">{vehicle?.registrationNumber ?? "—"}</td>
                  <td className="px-3 py-2">
                    {d.shiftStart ?? "08:00"}–{d.shiftEnd ?? "18:00"}
                  </td>
                  <td className="px-3 py-2">
                    {done}/{today.length}
                  </td>
                  <td className="px-3 py-2 text-mute">{formatLastSeen(d.updatedAt)}</td>
                  <td className="px-3 py-2">
                    {canWrite ? (
                      <div className="flex flex-wrap gap-1">
                        <select
                          className="border border-hairline bg-paper px-1 py-1"
                          defaultValue=""
                          disabled={busy}
                          onChange={(e) => {
                            const status = e.target.value;
                            e.target.value = "";
                            if (status) void run("Update status", () => updateDriver(actor, d.id, { status }));
                          }}
                        >
                          <option value="">Status…</option>
                          {DRIVER_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <select
                          className="border border-hairline bg-paper px-1 py-1"
                          defaultValue=""
                          disabled={busy}
                          onChange={(e) => {
                            const vehicleId = e.target.value;
                            e.target.value = "";
                            const vehicle = vehiclesQ.data.find((v) => v.id === vehicleId);
                            if (!vehicle) return;
                            void run("Assign vehicle", () => assignDriverVehicle({ actor, driver: d, vehicle }));
                          }}
                        >
                          <option value="">Assign vehicle…</option>
                          {vehiclesQ.data
                            .filter((v) => v.active !== false && v.status !== "BREAKDOWN" && v.status !== "MAINTENANCE")
                            .map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.registrationNumber}
                              </option>
                            ))}
                        </select>
                        <button
                          type="button"
                          className="border border-hairline px-2 py-1"
                          disabled={busy}
                          onClick={() => void run("Unassign", () => unassignDriverVehicle({ actor, driver: d }))}
                        >
                          Unassign
                        </button>
                        <button
                          type="button"
                          className="border border-coral px-2 py-1 text-coral"
                          disabled={busy}
                          onClick={() => {
                            if (!window.confirm("Deactivate driver?")) return;
                            void run("Deactivate", () => deactivateDriver(actor, d.id));
                          }}
                        >
                          Deactivate
                        </button>
                      </div>
                    ) : (
                      <span className="text-mute">read-only</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </OpsPageShell>
  );
}

export function DriverDetailPage({ driverId, basePath = "/admin/drivers" }: { driverId: string; basePath?: string }) {
  const { profile } = useAuth();
  const driversQ = useRealtimeDrivers(profile?.organizationId);
  const vehiclesQ = useRealtimeVehicles(profile?.organizationId);
  const deliveriesQ = useRealtimeDeliveries(profile?.organizationId);
  const driver = driversQ.data.find((d) => d.id === driverId);
  const vehicle = vehiclesQ.data.find((v) => v.id === driver?.assignedVehicleId);
  const mine = deliveriesQ.data.filter((d) => d.driverId === driverId || d.driverUserId === driver?.userId);
  const completed = mine.filter((d) => d.status === "DELIVERED").length;
  const remaining = mine.filter((d) => !["DELIVERED", "FAILED"].includes(d.status)).length;
  const atRisk = mine.filter((d) => d.riskLevel === "high" || d.riskLevel === "critical").length;

  if (!driver) {
    return (
      <main className="px-4 py-8 font-sans text-mute">
        Loading driver… <Link to={basePath}>Back</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[960px] px-4 py-6">
      <Link to={basePath} className="font-sans text-[13px] text-mute underline">
        ← Drivers
      </Link>
      <h1 className="mt-2 font-sans text-[28px] font-semibold">{driver.name}</h1>
      <p className="font-mono text-[12px] text-mute">
        {driver.status} · Last active {formatLastSeen(driver.locationTimestamp ?? driver.updatedAt)}
        <SyntheticBadge synthetic={driver.synthetic} dataSource={driver.dataSource} />
      </p>
      <dl className="mt-6 grid gap-3 border border-hairline bg-snow p-4 font-mono text-[12px] sm:grid-cols-2">
        <div>
          <dt className="text-mute">Phone</dt>
          <dd>{driver.phone || "—"}</dd>
        </div>
        <div>
          <dt className="text-mute">License</dt>
          <dd>{driver.licenseNumber || "—"}</dd>
        </div>
        <div>
          <dt className="text-mute">Assigned vehicle</dt>
          <dd>{vehicle?.registrationNumber ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-mute">Linked userId</dt>
          <dd>{driver.userId ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-mute">Today completed</dt>
          <dd>{completed}</dd>
        </div>
        <div>
          <dt className="text-mute">Remaining</dt>
          <dd>{remaining}</dd>
        </div>
        <div>
          <dt className="text-mute">At-risk</dt>
          <dd>{atRisk}</dd>
        </div>
        <div>
          <dt className="text-mute">Shift</dt>
          <dd>
            {driver.shiftStart ?? "08:00"}–{driver.shiftEnd ?? "18:00"}
          </dd>
        </div>
      </dl>
      <h2 className="mt-8 font-sans text-[18px] font-semibold">Today&apos;s deliveries</h2>
      <ul className="mt-3 space-y-2">
        {mine.map((d) => (
          <li key={d.id} className="border border-hairline bg-snow px-3 py-2 font-mono text-[12px]">
            {d.orderId} · {d.customerName} · <StatusBadge status={d.status} /> · risk {d.riskLevel ?? "—"}
          </li>
        ))}
        {mine.length === 0 && <li className="text-mute">No deliveries assigned.</li>}
      </ul>
    </main>
  );
}
