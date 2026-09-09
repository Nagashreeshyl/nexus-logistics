import { useMemo, useState } from "react";
import { useAuth } from "../firebase/AuthProvider";
import { useRealtimeCustomers } from "../hooks/useRealtimeOps";
import { MetricGrid, OpsPageShell, SearchFilterBar, SyntheticBadge } from "../components/ops/OpsPageShell";
import { formatLastSeen } from "../components/ops/OpsBadges";
import { useToast } from "../components/ops/useToast";
import { createCustomer, deactivateCustomer, generateSyntheticCustomer } from "../services/firestore/entityCrud";

export function CustomersPage({ readOnly = false }: { readOnly?: boolean }) {
  const { profile, firebaseUser, can } = useAuth();
  const orgId = profile?.organizationId;
  const customersQ = useRealtimeCustomers(orgId);
  const { show, toastEl } = useToast();
  const [search, setSearch] = useState("");
  const [zone, setZone] = useState("");
  const [busy, setBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const canWrite = !readOnly && (can("manage_orders") || can("manage_fleet"));
  const actor = { uid: firebaseUser?.uid ?? "", email: profile?.email ?? "", organizationId: orgId ?? "" };

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    return customersQ.data
      .filter((c) => {
        if (zone && c.zone !== zone) return false;
        if (q && !`${c.name} ${c.company ?? ""} ${c.address}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [customersQ.data, search, zone]);

  const zones = useMemo(() => [...new Set(customersQ.data.map((c) => c.zone).filter(Boolean))] as string[], [customersQ.data]);

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
      title="Customers"
      subtitle="Delivery master data — not a CRM. Reused by Orders."
      connection={customersQ.connection}
      actions={
        canWrite ? (
          <>
            <button
              type="button"
              disabled={busy}
              className="border border-hairline px-3 py-2 font-sans text-[13px] font-semibold"
              onClick={() => setFormOpen((v) => !v)}
            >
              {formOpen ? "Close form" : "Create customer"}
            </button>
            <button
              type="button"
              disabled={busy}
              className="bg-coral px-3 py-2 font-sans text-[13px] font-semibold disabled:opacity-40"
              onClick={() => void run("Synthetic customer", () => generateSyntheticCustomer(actor).then(() => undefined))}
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
          ["Total", customersQ.data.length],
          ["Active", customersQ.data.filter((c) => c.active !== false).length],
          ["Inactive", customersQ.data.filter((c) => c.active === false).length],
          ["Zones", zones.length],
        ]}
      />

      {formOpen && canWrite && (
        <form
          className="mt-4 grid gap-2 border border-hairline bg-snow p-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void run("Create customer", async () => {
              await createCustomer(actor, {
                name: String(fd.get("name") ?? ""),
                company: String(fd.get("company") ?? ""),
                phone: String(fd.get("phone") ?? ""),
                email: String(fd.get("email") ?? ""),
                address: String(fd.get("address") ?? ""),
                latitude: Number(fd.get("latitude")),
                longitude: Number(fd.get("longitude")),
                zone: String(fd.get("zone") ?? "CENTRAL"),
                preferredDeliveryWindowStart: String(fd.get("wStart") ?? "09:00"),
                preferredDeliveryWindowEnd: String(fd.get("wEnd") ?? "17:00"),
                notes: String(fd.get("notes") ?? ""),
              });
              setFormOpen(false);
              e.currentTarget.reset();
            });
          }}
        >
          <input name="name" required placeholder="Name" className="border border-hairline px-2 py-2 font-sans text-[13px]" />
          <input name="company" placeholder="Company" className="border border-hairline px-2 py-2 font-sans text-[13px]" />
          <input name="phone" placeholder="Phone" className="border border-hairline px-2 py-2 font-sans text-[13px]" />
          <input name="email" placeholder="Email" className="border border-hairline px-2 py-2 font-sans text-[13px]" />
          <input name="address" required placeholder="Address" className="border border-hairline px-2 py-2 font-sans text-[13px] sm:col-span-2" />
          <input name="latitude" required type="number" step="any" placeholder="Latitude" className="border border-hairline px-2 py-2 font-mono text-[13px]" />
          <input name="longitude" required type="number" step="any" placeholder="Longitude" className="border border-hairline px-2 py-2 font-mono text-[13px]" />
          <input name="zone" placeholder="Zone" defaultValue="CENTRAL" className="border border-hairline px-2 py-2 font-sans text-[13px]" />
          <div className="flex gap-2">
            <input name="wStart" defaultValue="09:00" className="w-full border border-hairline px-2 py-2 font-mono text-[13px]" />
            <input name="wEnd" defaultValue="17:00" className="w-full border border-hairline px-2 py-2 font-mono text-[13px]" />
          </div>
          <input name="notes" placeholder="Notes" className="border border-hairline px-2 py-2 font-sans text-[13px] sm:col-span-2" />
          <button type="submit" disabled={busy} className="bg-ink px-3 py-2 font-sans text-[13px] font-semibold text-snow sm:col-span-2">
            Save to Firestore
          </button>
        </form>
      )}

      <SearchFilterBar search={search} onSearch={setSearch}>
        <select className="border border-hairline bg-paper px-2 py-2 font-mono text-[12px]" value={zone} onChange={(e) => setZone(e.target.value)}>
          <option value="">All zones</option>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
      </SearchFilterBar>

      <div className="mt-4 overflow-x-auto border border-hairline bg-snow">
        <table className="min-w-full font-mono text-[12px]">
          <thead className="border-b border-hairline bg-paper text-mute">
            <tr>
              {["Name", "Address", "Zone", "Window", "Updated", "Actions"].map((h) => (
                <th key={h} className="px-3 py-2 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-hairline/70">
                <td className="px-3 py-2 font-semibold">
                  {c.name}
                  <SyntheticBadge synthetic={c.synthetic} dataSource={c.dataSource} />
                  {c.active === false ? <span className="ml-1 text-coral">inactive</span> : null}
                </td>
                <td className="max-w-[220px] px-3 py-2 text-mute">{c.address}</td>
                <td className="px-3 py-2">{c.zone ?? "—"}</td>
                <td className="px-3 py-2">
                  {c.preferredDeliveryWindowStart ?? "09:00"}–{c.preferredDeliveryWindowEnd ?? "17:00"}
                </td>
                <td className="px-3 py-2 text-mute">{formatLastSeen(c.updatedAt)}</td>
                <td className="px-3 py-2">
                  {canWrite ? (
                    <button
                      type="button"
                      className="border border-coral px-2 py-1 text-coral"
                      disabled={busy || c.active === false}
                      onClick={() => {
                        if (!window.confirm("Deactivate customer?")) return;
                        void run("Deactivate", () => deactivateCustomer(actor, c.id));
                      }}
                    >
                      Deactivate
                    </button>
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
