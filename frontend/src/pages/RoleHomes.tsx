import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../firebase/AuthProvider";
import { ROLE_LABEL, Role } from "../lib/roles";
import { DispatcherOpsPage } from "./DispatcherOpsPage";
import { DriverOpsPage } from "./DriverOpsPage";
import { RealtimeTestConsolePage } from "./RealtimeTestConsolePage";
import { useRealtimeOrganization } from "../hooks/useRealtimeOps";
import { LiveSyncBadge, formatLastSeen } from "../components/ops/OpsBadges";

function ProfileCard({ title, role }: { title: string; role: Role }) {
  const { profile, firebaseUser } = useAuth();
  const orgQ = useRealtimeOrganization(profile?.organizationId);
  if (!profile) return null;
  return (
    <main className="mx-auto max-w-[960px] px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-sans text-[12px] font-semibold uppercase tracking-wide text-coral">V2.4 foundation</p>
          <h1 className="mt-1 font-sans text-[28px] font-semibold">{title}</h1>
        </div>
        <LiveSyncBadge connection={orgQ.connection} />
      </div>
      <p className="mt-2 max-w-[62ch] font-sans text-[14px] text-mute">
        Placeholder for {ROLE_LABEL[role]}-specific tools. Organization doc updates live via Firestore.
      </p>
      <dl className="mt-6 grid gap-3 border border-hairline bg-snow p-5 font-mono text-[12px] sm:grid-cols-2">
        <div>
          <dt className="text-mute">UID</dt>
          <dd className="text-ink">{firebaseUser?.uid}</dd>
        </div>
        <div>
          <dt className="text-mute">Email</dt>
          <dd className="text-ink">{profile.email}</dd>
        </div>
        <div>
          <dt className="text-mute">Organization</dt>
          <dd className="text-ink">
            {profile.organizationId}
            {orgQ.organization?.name ? ` · ${String(orgQ.organization.name)}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-mute">Last active</dt>
          <dd className="text-ink">{formatLastSeen(profile.lastSeenAt)}</dd>
        </div>
        <div>
          <dt className="text-mute">Authorized roles[]</dt>
          <dd className="text-ink">{profile.roles.map((r) => ROLE_LABEL[r]).join(", ") || "(empty)"}</dd>
        </div>
        <div>
          <dt className="text-mute">activeRole (UX only)</dt>
          <dd className="text-ink">{ROLE_LABEL[profile.activeRole]}</dd>
        </div>
      </dl>
    </main>
  );
}

export function AdminHome() {
  return <ProfileCard title="Admin" role="admin" />;
}

export function AnalystHome() {
  return <ProfileCard title="Analyst" role="analyst" />;
}

export function DispatcherHome() {
  return (
    <Routes>
      <Route index element={<DispatcherOpsPage />} />
      <Route path="realtime-lab" element={<RealtimeTestConsolePage />} />
      <Route path="*" element={<Navigate to="." replace />} />
    </Routes>
  );
}

export function DriverHome() {
  return <DriverOpsPage />;
}
