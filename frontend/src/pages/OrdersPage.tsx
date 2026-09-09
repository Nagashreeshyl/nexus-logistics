import { useMemo, useState } from "react";
import { useAuth } from "../firebase/AuthProvider";
import {
  mergeConnection,
  useRealtimeDeliveries,
  useRealtimeDrivers,
  useRealtimeOrders,
  useRealtimeVehicles,
} from "../hooks/useRealtimeOps";
import { useRealtimeCustomers } from "../hooks/useRealtimeOps";
import { MetricGrid, OpsPageShell, SearchFilterBar, SyntheticBadge } from "../components/ops/OpsPageShell";
import { RiskPill, StatusBadge, formatLastSeen } from "../components/ops/OpsBadges";
import { useToast } from "../components/ops/useToast";
import {
  assignOrderDelivery,
  cancelOrder,
  createOrder,
  generateSyntheticOrder,
} from "../services/firestore/entityCrud";
import { ORDER_PRIORITIES, ORDER_STATUSES } from "../lib/opsEnums";
import type { OpsOrder } from "../lib/opsTypes";

export function OrdersPage({ readOnly = false }: { readOnly?: boolean }) {
  const { profile, firebaseUser, can } = useAuth();
  const orgId = profile?.organizationId;
  const ordersQ = useRealtimeOrders(orgId);
  const customersQ = useRealtimeCustomers(orgId);
  const driversQ = useRealtimeDrivers(orgId);
  const vehiclesQ = useRealtimeVehicles(orgId);
  const deliveriesQ = useRealtimeDeliveries(orgId);
  const connection = mergeConnection(ordersQ.connection, customersQ.connection);
  const { show, toastEl } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const canWrite = !readOnly && can("manage_orders");
  const actor = { uid: firebaseUser?.uid ?? "", email: profile?.email ?? "", organizationId: orgId ?? "" };

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    return ordersQ.data
      .filter((o) => {
        if (statusFilter && o.status !== statusFilter) return false;
        if (priorityFilter && String(o.priority) !== priorityFilter) return false;
        if (q && !`${o.id} ${o.customerName ?? ""} ${o.destination ?? o.address ?? ""}`.toLowerCase().includes(q)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }, [ordersQ.data, search, statusFilter, priorityFilter]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      show(`${label} — Firestore updated`);
    } catch (e) {
      show(e instanceof Error ? e.message : String(e), "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <OpsPageShell
      title="Orders"
      subtitle="Create and assign orders. Delivery execution uses the V2.4 state machine."
      connection={connection}
      actions={
        canWrite ? (
          <>
            <button type="button" className="border border-hairline px-3 py-2 font-sans text-[13px] font-semibold" onClick={() => setFormOpen((v) => !v)}>
              {formOpen ? "Close form" : "Create order"}
            </button>
            <button
              type="button"
              disabled={busy || customersQ.data.length === 0}
              className="bg-coral px-3 py-2 font-sans text-[13px] font-semibold disabled:opacity-40"
              onClick={() => {
                const customer = customersQ.data.find((c) => c.active !== false) ?? customersQ.data[0];
                if (!customer) {
                  show("Create a customer first", "err");
                  return;
                }
                void run("Synthetic order", () => generateSyntheticOrder(actor, customer).then(() => undefined));
              }}
            >
              Generate Synthetic
            </button>
          </>
        ) : null
      }
    >
      {toastEl}
      <MetricGrid
        items={[
          ["Total", ordersQ.data.length],
          ["Created", ordersQ.data.filter((o) => o.status === "CREATED").length],
          ["Assigned", ordersQ.data.filter((o) => o.status === "ASSIGNED").length],
          ["Completed", ordersQ.data.filter((o) => o.status === "COMPLETED").length],
          ["Cancelled", ordersQ.data.filter((o) => o.status === "CANCELLED").length],
          ["Deliveries", deliveriesQ.data.length],
        ]}
      />

      {formOpen && canWrite && (
        <form
          className="mt-4 grid gap-2 border border-hairline bg-snow p-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const customerId = String(fd.get("customerId") ?? "");
            const customer = customersQ.data.find((c) => c.id === customerId);
            if (!customer) {
              show("Select a customer", "err");
              return;
            }
            void run("Create order", async () => {
              await createOrder(actor, {
                customer,
                customerId: customer.id,
                customerName: customer.name,
                destination: String(fd.get("destination") || customer.address),
                latitude: Number(fd.get("latitude") || customer.latitude),
                longitude: Number(fd.get("longitude") || customer.longitude),
                demandKg: Number(fd.get("demandKg")),
                volume: Number(fd.get("volume") || 0),
                priority: String(fd.get("priority") || "MEDIUM"),
                timeWindowStart: String(fd.get("wStart") || "09:00"),
                timeWindowEnd: String(fd.get("wEnd") || "17:00"),
                serviceDurationMinutes: Number(fd.get("service") || 15),
                requestedDate: String(fd.get("date") || new Date().toISOString().slice(0, 10)),
                origin: "Nexus Depot",
                notes: String(fd.get("notes") ?? ""),
              });
              setFormOpen(false);
            });
          }}
        >
          <label className="font-sans text-[12px] font-semibold sm:col-span-2">
            Customer
            <select name="customerId" required className="mt-1 w-full border border-hairline px-2 py-2 font-sans text-[13px]">
              <option value="">Select customer…</option>
              {customersQ.data
                .filter((c) => c.active !== false)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.address}
                  </option>
                ))}
            </select>
          </label>
          <input name="destination" placeholder="Destination (defaults to customer address)" className="border border-hairline px-2 py-2 font-sans text-[13px] sm:col-span-2" />
          <input name="demandKg" required type="number" min={1} placeholder="Demand kg" className="border border-hairline px-2 py-2 font-mono text-[13px]" />
          <input name="volume" type="number" min={0} defaultValue={1} placeholder="Volume" className="border border-hairline px-2 py-2 font-mono text-[13px]" />
          <select name="priority" defaultValue="HIGH" className="border border-hairline px-2 py-2 font-sans text-[13px]">
            {ORDER_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="border border-hairline px-2 py-2 font-mono text-[13px]" />
          <input name="wStart" defaultValue="09:00" className="border border-hairline px-2 py-2 font-mono text-[13px]" />
          <input name="wEnd" defaultValue="11:00" className="border border-hairline px-2 py-2 font-mono text-[13px]" />
          <input name="service" type="number" defaultValue={15} className="border border-hairline px-2 py-2 font-mono text-[13px]" />
          <input name="notes" placeholder="Notes" className="border border-hairline px-2 py-2 font-sans text-[13px] sm:col-span-2" />
          <button type="submit" disabled={busy} className="bg-ink px-3 py-2 font-sans text-[13px] font-semibold text-snow sm:col-span-2">
            Create order in Firestore
          </button>
        </form>
      )}

      <SearchFilterBar search={search} onSearch={setSearch} placeholder="Order / customer / destination">
        <select className="border border-hairline bg-paper px-2 py-2 font-mono text-[12px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select className="border border-hairline bg-paper px-2 py-2 font-mono text-[12px]" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
          <option value="">All priorities</option>
          {ORDER_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </SearchFilterBar>

      <div className="mt-4 overflow-x-auto border border-hairline bg-snow">
        <table className="min-w-full font-mono text-[12px]">
          <thead className="border-b border-hairline bg-paper text-mute">
            <tr>
              {["Order", "Customer", "Priority", "Demand", "Window", "Status", "Updated", "Assign"].map((h) => (
                <th key={h} className="px-3 py-2 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((o: OpsOrder) => (
              <tr key={o.id} className="border-b border-hairline/70 align-top">
                <td className="px-3 py-2">
                  {o.id.slice(0, 8)}…
                  <SyntheticBadge synthetic={o.synthetic} dataSource={o.dataSource} />
                </td>
                <td className="px-3 py-2">{o.customerName}</td>
                <td className="px-3 py-2">
                  <RiskPill level={String(o.priority ?? "").toLowerCase()} />
                </td>
                <td className="px-3 py-2 tabular">{o.demandKg ?? "—"} kg</td>
                <td className="px-3 py-2">
                  {o.timeWindowStart}–{o.timeWindowEnd}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={String(o.status ?? "CREATED")} />
                </td>
                <td className="px-3 py-2 text-mute">{formatLastSeen(o.updatedAt)}</td>
                <td className="px-3 py-2">
                  {canWrite ? (
                    <div className="flex flex-wrap gap-1">
                      <select
                        className="border border-hairline bg-paper px-1 py-1"
                        defaultValue=""
                        disabled={busy}
                        onChange={(e) => {
                          const raw = e.target.value;
                          e.target.value = "";
                          if (!raw) return;
                          const [driverId, vehicleId] = raw.split("|");
                          const driver = driversQ.data.find((d) => d.id === driverId);
                          const vehicle = vehiclesQ.data.find((v) => v.id === vehicleId);
                          if (!driver || !vehicle) return;
                          void run("Assign delivery", () =>
                            assignOrderDelivery({ actor, order: o, driver, vehicle }).then(() => undefined),
                          );
                        }}
                      >
                        <option value="">Driver + vehicle…</option>
                        {driversQ.data
                          .filter((d) => d.active !== false && d.userId)
                          .flatMap((d) => {
                            const vids = d.assignedVehicleId
                              ? [d.assignedVehicleId]
                              : vehiclesQ.data.filter((v) => v.active !== false).map((v) => v.id);
                            return vids.map((vid) => {
                              const v = vehiclesQ.data.find((x) => x.id === vid);
                              return (
                                <option key={`${d.id}-${vid}`} value={`${d.id}|${vid}`}>
                                  {d.name} / {v?.registrationNumber ?? vid.slice(0, 6)}
                                </option>
                              );
                            });
                          })}
                      </select>
                      <button
                        type="button"
                        className="border border-coral px-2 py-1 text-coral"
                        disabled={busy}
                        onClick={() => {
                          if (!window.confirm("Cancel order?")) return;
                          void run("Cancel", () => cancelOrder(actor, o));
                        }}
                      >
                        Cancel
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
    </OpsPageShell>
  );
}
