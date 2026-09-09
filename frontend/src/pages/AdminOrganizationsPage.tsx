import { useAuth } from "../firebase/AuthProvider";
import { useRealtimeOrganization } from "../hooks/useRealtimeOps";
import { OpsPageShell } from "../components/ops/OpsPageShell";
import { formatLastSeen } from "../components/ops/OpsBadges";

/** Admin Organizations — show the caller's organization document. */
export function AdminOrganizationsPage() {
  const { profile, can } = useAuth();
  const orgId = profile?.organizationId;
  const orgQ = useRealtimeOrganization(orgId);

  return (
    <OpsPageShell
      title="Organizations"
      subtitle="Organization record for the signed-in admin. Cross-org access is denied by Firestore rules."
      connection={orgQ.connection}
    >
      {!can("manage_users") && (
        <p className="mt-4 border border-coral bg-snow px-3 py-2 font-sans text-[13px] text-coral">
          Missing manage_users permission in roles[].
        </p>
      )}
      {orgQ.error && (
        <p className="mt-4 border border-coral bg-snow px-3 py-2 font-sans text-[13px] text-coral">{orgQ.error}</p>
      )}
      <dl className="mt-6 grid gap-3 border border-hairline bg-snow p-5 font-mono text-[12px] sm:grid-cols-2">
        <div>
          <dt className="text-mute">Organization ID</dt>
          <dd>{orgId ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-mute">Name</dt>
          <dd>{orgQ.organization?.name ? String(orgQ.organization.name) : "—"}</dd>
        </div>
        <div>
          <dt className="text-mute">Status</dt>
          <dd>{orgQ.organization?.status ? String(orgQ.organization.status) : "—"}</dd>
        </div>
        <div>
          <dt className="text-mute">Updated</dt>
          <dd>{formatLastSeen(orgQ.organization?.updatedAt)}</dd>
        </div>
      </dl>
      {orgQ.organization && (
        <pre className="mt-4 overflow-x-auto border border-hairline bg-paper p-4 font-mono text-[11px] text-mute">
          {JSON.stringify(orgQ.organization, null, 2)}
        </pre>
      )}
    </OpsPageShell>
  );
}
