import { useMemo } from "react";
import { useAuth } from "../firebase/AuthProvider";
import { useRealtimeAuditLogs } from "../hooks/useRealtimeAuditLogs";
import { OpsPageShell } from "../components/ops/OpsPageShell";
import { formatLastSeen } from "../components/ops/OpsBadges";

/** Admin Audit — org-scoped auditLogs listener (admin/analyst read per rules). */
export function AdminAuditPage() {
  const { profile, can } = useAuth();
  const orgId = profile?.organizationId;
  const auditQ = useRealtimeAuditLogs(orgId);
  const canView = can("view_audit");

  const rows = useMemo(() => {
    const list = [...auditQ.data];
    list.sort((a, b) => {
      const ta = (a.timestamp as { seconds?: number })?.seconds ?? 0;
      const tb = (b.timestamp as { seconds?: number })?.seconds ?? 0;
      return tb - ta;
    });
    return list.slice(0, 200);
  }, [auditQ.data]);

  return (
    <OpsPageShell
      title="Audit"
      subtitle="Firestore auditLogs for this organization (newest first, capped at 200). Writes are append-only; updates/deletes are denied by rules."
      connection={auditQ.connection}
    >
      {!canView && (
        <p className="mt-4 border border-coral bg-snow px-3 py-2 font-sans text-[13px] text-coral">
          Missing view_audit permission in roles[].
        </p>
      )}
      {auditQ.error && (
        <p className="mt-4 border border-coral bg-snow px-3 py-2 font-sans text-[13px] text-coral">{auditQ.error}</p>
      )}
      <div className="mt-6 overflow-x-auto border border-hairline bg-snow">
        <table className="min-w-full font-mono text-[12px]">
          <thead className="border-b border-hairline bg-paper text-mute">
            <tr>
              {["When", "Event", "Entity", "Actor", "Metadata"].map((h) => (
                <th key={h} className="px-3 py-2 text-left font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !auditQ.loading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-mute">
                  No audit records yet (or best-effort writes have not landed).
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-hairline align-top">
                <td className="px-3 py-2 whitespace-nowrap">{formatLastSeen(row.timestamp ?? row.createdAt)}</td>
                <td className="px-3 py-2">{String(row.eventType ?? row.action ?? "—")}</td>
                <td className="px-3 py-2">
                  {String(row.entityType ?? "—")} / {String(row.entityId ?? "—").slice(0, 16)}
                </td>
                <td className="px-3 py-2">{String(row.actorEmail ?? row.actorUid ?? row.actorId ?? "—")}</td>
                <td className="max-w-[280px] px-3 py-2 text-mute">
                  {row.metadata ? JSON.stringify(row.metadata).slice(0, 120) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </OpsPageShell>
  );
}
