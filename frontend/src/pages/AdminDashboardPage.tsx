import { Link } from "react-router-dom";
import { useAuth } from "../firebase/AuthProvider";
import {
  mergeConnection,
  useRealtimeDeliveries,
  useRealtimeDrivers,
  useRealtimeExceptions,
  useRealtimeOrders,
  useRealtimeOrganization,
  useRealtimeVehicles,
} from "../hooks/useRealtimeOps";
import { LiveSyncBadge, formatLastSeen } from "../components/ops/OpsBadges";
import { MetricGrid, OpsPageShell } from "../components/ops/OpsPageShell";
import { ROLE_LABEL } from "../lib/roles";

/**
 * Admin control home — live org snapshot + links to admin modules.
 * Authorization still uses roles[]; this page is presentation for the admin workspace.
 */
export function AdminDashboardPage() {
  const { profile, firebaseUser, can } = useAuth();
  const orgId = profile?.organizationId;
  const orgQ = useRealtimeOrganization(orgId);
  const ordersQ = useRealtimeOrders(orgId);
  const deliveriesQ = useRealtimeDeliveries(orgId);
  const vehiclesQ = useRealtimeVehicles(orgId);
  const driversQ = useRealtimeDrivers(orgId);
  const exceptionsQ = useRealtimeExceptions(orgId);
  const connection = mergeConnection(
    orgQ.connection,
    ordersQ.connection,
    deliveriesQ.connection,
    vehiclesQ.connection,
    driversQ.connection,
    exceptionsQ.connection,
  );

  const metrics: Array<[string, string | number]> = [
    ["Organization", orgQ.organization?.name ? String(orgQ.organization.name) : orgId ?? "—"],
    ["Orders", ordersQ.data.length],
    ["Deliveries", deliveriesQ.data.length],
    ["Vehicles", vehiclesQ.data.length],
    ["Drivers", driversQ.data.length],
    ["Open exceptions", exceptionsQ.data.filter((e) => e.status === "open").length],
  ];

  const modules = [
    { label: "Fleet", to: "/admin/fleet", ok: can("manage_fleet") },
    { label: "Drivers", to: "/admin/drivers", ok: can("manage_fleet") },
    { label: "Customers", to: "/admin/customers", ok: can("manage_orders") },
    { label: "Orders", to: "/admin/orders", ok: can("manage_orders") },
    { label: "Users", to: "/admin/users", ok: can("manage_users") },
    { label: "Organizations", to: "/admin/organizations", ok: can("manage_users") },
    { label: "Audit", to: "/admin/audit", ok: can("view_audit") },
  ];

  return (
    <OpsPageShell
      title="Admin control"
      subtitle="Live Firestore snapshot for this organization. roles[] authorize; activeRole is workspace presentation only."
      connection={connection}
    >
      <MetricGrid items={metrics} />

      <section className="mt-8 border border-hairline bg-snow p-5">
        <h2 className="font-sans text-[16px] font-semibold">Signed-in admin</h2>
        <dl className="mt-3 grid gap-3 font-mono text-[12px] sm:grid-cols-2">
          <div>
            <dt className="text-mute">UID</dt>
            <dd>{firebaseUser?.uid ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-mute">Email</dt>
            <dd>{profile?.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-mute">Authorized roles[]</dt>
            <dd>{profile?.roles.map((r) => ROLE_LABEL[r]).join(", ") || "(empty)"}</dd>
          </div>
          <div>
            <dt className="text-mute">activeRole (workspace)</dt>
            <dd>{profile ? ROLE_LABEL[profile.activeRole] : "—"}</dd>
          </div>
          <div>
            <dt className="text-mute">Last active</dt>
            <dd>{formatLastSeen(profile?.lastSeenAt)}</dd>
          </div>
          <div>
            <dt className="text-mute">Org sync</dt>
            <dd className="flex items-center gap-2">
              <LiveSyncBadge connection={orgQ.connection} />
              {orgQ.error ? <span className="text-coral">{orgQ.error}</span> : null}
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-8">
        <h2 className="font-sans text-[16px] font-semibold">Admin modules</h2>
        <p className="mt-1 font-sans text-[13px] text-mute">Open a module to manage live operational data.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) =>
            m.ok ? (
              <Link
                key={m.to}
                to={m.to}
                className="border border-hairline bg-snow px-4 py-3 font-sans text-[14px] font-semibold hover:border-ink"
              >
                {m.label}
              </Link>
            ) : (
              <span
                key={m.to}
                className="border border-hairline bg-snow/50 px-4 py-3 font-sans text-[14px] text-mute"
                title="Missing permission in roles[]"
              >
                {m.label} (denied)
              </span>
            ),
          )}
        </div>
      </section>
    </OpsPageShell>
  );
}
