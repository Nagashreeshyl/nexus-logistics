import { useMemo } from "react";
import { useAuth } from "../firebase/AuthProvider";
import { useRealtimeOrgUsers } from "../hooks/useRealtimeOrgUsers";
import { OpsPageShell } from "../components/ops/OpsPageShell";
import { formatLastSeen } from "../components/ops/OpsBadges";
import { ROLE_LABEL, type Role } from "../lib/roles";

/** Admin Users — org-scoped user directory from Firestore (read). */
export function AdminUsersPage() {
  const { profile, can } = useAuth();
  const orgId = profile?.organizationId;
  const usersQ = useRealtimeOrgUsers(orgId);
  const canManage = can("manage_users");

  const rows = useMemo(() => {
    const list = [...usersQ.data];
    list.sort((a, b) => String(a.email ?? "").localeCompare(String(b.email ?? "")));
    return list;
  }, [usersQ.data]);

  return (
    <OpsPageShell
      title="Users"
      subtitle="Organization directory from Firestore users collection. Role changes are provisioned server-side — clients cannot escalate roles[]."
      connection={usersQ.connection}
    >
      {!canManage && (
        <p className="mt-4 border border-coral bg-snow px-3 py-2 font-sans text-[13px] text-coral">
          Missing manage_users permission in roles[].
        </p>
      )}
      {usersQ.error && (
        <p className="mt-4 border border-coral bg-snow px-3 py-2 font-sans text-[13px] text-coral">{usersQ.error}</p>
      )}
      <div className="mt-6 overflow-x-auto border border-hairline bg-snow">
        <table className="min-w-full font-mono text-[12px]">
          <thead className="border-b border-hairline bg-paper text-mute">
            <tr>
              {["Email", "Display name", "roles[]", "activeRole", "Status", "Last active", "UID"].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !usersQ.loading && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-mute">
                  No users found for this organization.
                </td>
              </tr>
            )}
            {rows.map((u) => {
              const roles = (Array.isArray(u.roles) ? u.roles : []) as Role[];
              return (
                <tr key={u.id} className="border-t border-hairline">
                  <td className="px-3 py-2">{String(u.email ?? "—")}</td>
                  <td className="px-3 py-2">{String(u.displayName ?? "—")}</td>
                  <td className="px-3 py-2">
                    {roles.map((r) => ROLE_LABEL[r] ?? r).join(", ") || "—"}
                  </td>
                  <td className="px-3 py-2">
                    {u.activeRole ? ROLE_LABEL[u.activeRole as Role] ?? String(u.activeRole) : "—"}
                  </td>
                  <td className="px-3 py-2">{String(u.status ?? "—")}</td>
                  <td className="px-3 py-2">{formatLastSeen(u.lastSeenAt)}</td>
                  <td className="px-3 py-2 text-mute">{u.id.slice(0, 12)}…</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 font-sans text-[12px] text-mute">
        To change roles, run <code className="font-mono">backend/scripts/provision_demo_users.py</code> with Admin
        credentials — Firestore rules block privilege escalation from the client.
      </p>
    </OpsPageShell>
  );
}
