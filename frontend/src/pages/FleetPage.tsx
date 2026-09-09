import { useMemo, useState } from "react";
import { useAuth } from "../firebase/AuthProvider";
import { mergeConnection, useRealtimeDrivers, useRealtimeVehicles } from "../hooks/useRealtimeOps";
import { MetricGrid, OpsPageShell, SearchFilterBar, SyntheticBadge } from "../components/ops/OpsPageShell";
import { StatusBadge, formatLastSeen } from "../components/ops/OpsBadges";
import { useToast } from "../components/ops/useToast";
import {
  assignDriverVehicle,
  deactivateVehicle,
  generateOperationalScenario,
  generateSyntheticVehicle,
  unassignDriverVehicle,
  updateVehicle,
} from "../services/firestore/entityCrud";
import { VEHICLE_STATUSES, VEHICLE_TYPES } from "../lib/opsEnums";
import type { OpsVehicle } from "../lib/opsTypes";

export function FleetPage({ readOnly = false }: { readOnly?: boolean }) {
  const { profile, firebaseUser, can } = useAuth();
  const orgId = profile?.organizationId;
  const vehiclesQ = useRealtimeVehicles(orgId);
  const driversQ = useRealtimeDrivers(orgId);
  const connection = mergeConnection(vehiclesQ.connection, driversQ.connection);
  const { show, toastEl } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const canWrite = !readOnly && can("manage_fleet");

  const actor = {
    uid: firebaseUser?.uid ?? "",
    email: profile?.email ?? "",
    organizationId: orgId ?? "",
  };

  const rows = useMemo(() => {
    return vehiclesQ.data
      .filter((v) => {
        const q = search.toLowerCase();
        const hay = `${v.registrationNumber ?? ""} ${v.vehicleType ?? v.type ?? ""} ${v.id}`.toLowerCase();
        if (q && !hay.includes(q)) return false;
        if (statusFilter && v.status !== statusFilter) return false;
        return true;
      })
      .sort((a, b) => String(a.registrationNumber).localeCompare(String(b.registrationNumber)));
  }, [vehiclesQ.data, search, statusFilter]);

  const metrics = useMemo(() => {
    const all = vehiclesQ.data;
    const count = (s: string) => all.filter((v) => v.status === s).length;
    const active = all.filter((v) => v.active !== false && v.status !== "INACTIVE");
    const utilized = active.filter((v) => v.status === "ASSIGNED" || v.status === "EN_ROUTE").length;
    const util = active.length ? Math.round((utilized / active.length) * 100) : 0;
    return [
      ["Total", all.length],
      ["Available", count("AVAILABLE")],
      ["Assigned", count("ASSIGNED")],
      ["En route", count("EN_ROUTE")],
      ["Maintenance", count("MAINTENANCE")],
      ["Breakdown", count("BREAKDOWN")],
      ["Inactive", count("INACTIVE")],
      ["Utilization %", util],
    ] as Array<[string, number | string]>;
  }, [vehiclesQ.data]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      show(`${label} — written to Firestore`);
    } catch (e) {
      show(e instanceof Error ? e.message : String(e), "err");
    } finally {
      setBusy(false);
    }
  }

  function driverName(v: OpsVehicle) {
    const id = v.driverId ?? v.assignedDriverId;
    return driversQ.data.find((d) => d.id === id)?.name ?? "—";
  }

  return (
    <OpsPageShell
      title="Fleet"
      subtitle="Live vehicle inventory from Firestore. Metrics are calculated — never hardcoded."
      connection={connection}
      actions={
        canWrite ? (
          <>
            <button
              type="button"
              disabled={busy}
              className="bg-coral px-3 py-2 font-sans text-[13px] font-semibold disabled:opacity-40"
              onClick={() => void run("Synthetic vehicle", () => generateSyntheticVehicle(actor).then(() => undefined))}
            >
              Generate Synthetic
            </button>
            <button
              type="button"
              disabled={busy}
              className="border border-hairline px-3 py-2 font-sans text-[13px] font-semibold disabled:opacity-40"
              onClick={() =>
                void run("Fleet scenario", () =>
                  generateOperationalScenario(actor, { vehicles: 5, drivers: 5, customers: 8, orders: 10 }, firebaseUser?.uid).then(
                    () => undefined,
                  ),
                )
              }
            >
              Generate Operational Scenario
            </button>
          </>
        ) : null
      }
    >
      {toastEl}
      <MetricGrid items={metrics} />
      <SearchFilterBar search={search} onSearch={setSearch} placeholder="Search registration / type / id">
        <select
          className="border border-hairline bg-paper px-2 py-2 font-mono text-[12px]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {VEHICLE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </SearchFilterBar>

      <div className="mt-4 overflow-x-auto border border-hairline bg-snow">
        <table className="min-w-full text-left font-mono text-[12px]">
          <thead className="border-b border-hairline bg-paper text-mute">
            <tr>
              {["Vehicle", "Registration", "Type", "Capacity", "Driver", "Status", "Location", "Updated", "Actions"].map((h) => (
                <th key={h} className="px-3 py-2 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-mute">
                  No vehicles yet. Use Generate Synthetic to seed Firestore.
                </td>
              </tr>
            )}
            {rows.map((v) => (
              <tr key={v.id} className="border-b border-hairline/70 align-top">
                <td className="px-3 py-2">
                  {v.id.slice(0, 8)}…
                  <SyntheticBadge synthetic={v.synthetic} dataSource={v.dataSource} />
                </td>
                <td className="px-3 py-2 font-semibold">{v.registrationNumber ?? "—"}</td>
                <td className="px-3 py-2">{v.vehicleType ?? v.type ?? "—"}</td>
                <td className="px-3 py-2 tabular">{v.capacityKg ?? v.capacity ?? "—"} kg</td>
                <td className="px-3 py-2">{driverName(v)}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={String(v.status ?? "AVAILABLE")} />
                </td>
                <td className="px-3 py-2 text-mute">
                  {v.currentLocation
                    ? `${v.currentLocation.lat.toFixed(3)}, ${v.currentLocation.lon.toFixed(3)}${
                        v.currentLocation.synthetic ? " · synthetic" : ""
                      }`
                    : "—"}
                </td>
                <td className="px-3 py-2 text-mute">{formatLastSeen(v.updatedAt)}</td>
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
                          if (!status) return;
                          void run(`Status ${status}`, () => updateVehicle(actor, v.id, { status }));
                        }}
                      >
                        <option value="">Status…</option>
                        {VEHICLE_STATUSES.map((s) => (
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
                          const driverId = e.target.value;
                          e.target.value = "";
                          if (!driverId) return;
                          const driver = driversQ.data.find((d) => d.id === driverId);
                          if (!driver) return;
                          void run("Assign driver", () => assignDriverVehicle({ actor, driver, vehicle: v }));
                        }}
                      >
                        <option value="">Assign driver…</option>
                        {driversQ.data
                          .filter((d) => d.active !== false)
                          .map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        className="border border-hairline px-2 py-1"
                        disabled={busy}
                        onClick={() => {
                          const driver = driversQ.data.find((d) => d.id === (v.driverId ?? v.assignedDriverId));
                          if (!driver) {
                            show("No linked driver", "err");
                            return;
                          }
                          void run("Unassign", () => unassignDriverVehicle({ actor, driver }));
                        }}
                      >
                        Unassign
                      </button>
                      <button
                        type="button"
                        className="border border-coral px-2 py-1 text-coral"
                        disabled={busy}
                        onClick={() => {
                          if (!window.confirm("Deactivate this vehicle?")) return;
                          void run("Deactivate", () => deactivateVehicle(actor, v.id));
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
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 font-mono text-[11px] text-mute">Vehicle types: {VEHICLE_TYPES.join(", ")}</p>
    </OpsPageShell>
  );
}
