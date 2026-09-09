import { useAuth } from "../firebase/AuthProvider";
import { ROLE_LABEL, Role } from "../lib/roles";

function ProfileCard({ title, role }: { title: string; role: Role }) {
  const { profile, firebaseUser } = useAuth();
  if (!profile) return null;
  return (
    <main className="mx-auto max-w-[960px] px-4 py-8">
      <p className="font-sans text-[12px] font-semibold uppercase tracking-wide text-coral">V2.3 foundation</p>
      <h1 className="mt-1 font-sans text-[28px] font-semibold">{title}</h1>
      <p className="mt-2 max-w-[62ch] font-sans text-[14px] text-mute">
        Placeholder route to verify Auth + RBAC. Profile fields update live via{" "}
        <code className="font-mono">useRealtimeUserProfile</code> (no refresh). Full dashboards come later.
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
          <dd className="text-ink">{profile.organizationId}</dd>
        </div>
        <div>
          <dt className="text-mute">driverId</dt>
          <dd className="text-ink">{profile.driverId ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-mute">Authorized roles[]</dt>
          <dd className="text-ink">{profile.roles.map((r) => ROLE_LABEL[r]).join(", ") || "(empty)"}</dd>
        </div>
        <div>
          <dt className="text-mute">activeRole (UX only)</dt>
          <dd className="text-ink">{ROLE_LABEL[profile.activeRole]}</dd>
        </div>
        <div>
          <dt className="text-mute">Route role gate</dt>
          <dd className="text-ink">{ROLE_LABEL[role]}</dd>
        </div>
        <div>
          <dt className="text-mute">Status</dt>
          <dd className="text-ink">{profile.status}</dd>
        </div>
      </dl>
    </main>
  );
}

export function AdminHome() {
  return <ProfileCard title="Admin" role="admin" />;
}
export function DispatcherHome() {
  return <ProfileCard title="Dispatcher / Operations" role="dispatcher" />;
}
export function DriverHome() {
  return <ProfileCard title="Driver" role="driver" />;
}
export function AnalystHome() {
  return <ProfileCard title="Analyst" role="analyst" />;
}
