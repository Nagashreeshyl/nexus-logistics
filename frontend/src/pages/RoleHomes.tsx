import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { ROLE_LABEL, Role, WORKSPACE_IDENTITY } from "../lib/roles";
import { useAuth } from "../firebase/AuthProvider";
import { useRealtimeOrganization } from "../hooks/useRealtimeOps";
import { LiveSyncBadge, formatLastSeen } from "../components/ops/OpsBadges";
import { DispatcherOpsPage } from "./DispatcherOpsPage";
import { DriverOpsPage } from "./DriverOpsPage";
import { RealtimeTestConsolePage } from "./RealtimeTestConsolePage";
import { FleetPage } from "./FleetPage";
import { CustomersPage } from "./CustomersPage";
import { DriversPage, DriverDetailPage } from "./DriversPage";
import { OrdersPage } from "./OrdersPage";
import { OptimizePage } from "./OptimizePage";
import { ExceptionsPage } from "./ExceptionsPage";

function WorkspaceHeader({ role }: { role: Role }) {
  const identity = WORKSPACE_IDENTITY[role];
  return (
    <div className="mb-6 border-b border-hairline pb-4">
      <p className="sys text-coral">{identity.eyebrow}</p>
      <h1 className="mt-1 font-sans text-[28px] font-semibold text-ink">{identity.title}</h1>
      <p className="mt-1 font-sans text-[14px] text-mute">{identity.description}</p>
    </div>
  );
}

function ProfileCard({ role }: { role: Role }) {
  const { profile, firebaseUser } = useAuth();
  const orgQ = useRealtimeOrganization(profile?.organizationId);
  if (!profile) return null;
  return (
    <main className="mx-auto max-w-[960px] px-4 py-8">
      <div className="flex items-start justify-between gap-3">
        <WorkspaceHeader role={role} />
        <LiveSyncBadge connection={orgQ.connection} />
      </div>
      <p className="max-w-[62ch] font-sans text-[14px] text-mute">
        {ROLE_LABEL[role]} workspace — operational modules use live Firestore. Authorization uses roles[]; activeRole is
        presentation only.
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
          <dt className="text-mute">activeRole (workspace only)</dt>
          <dd className="text-ink">{ROLE_LABEL[profile.activeRole]}</dd>
        </div>
      </dl>
    </main>
  );
}

function DriverDetailRoute({ basePath }: { basePath: string }) {
  const { driverId } = useParams();
  if (!driverId) return <Navigate to={basePath} replace />;
  return <DriverDetailPage driverId={driverId} basePath={basePath} />;
}

export function AdminHome() {
  return (
    <Routes>
      <Route index element={<ProfileCard role="admin" />} />
      <Route path="fleet" element={<FleetPage />} />
      <Route path="drivers" element={<DriversPage basePath="/admin/drivers" />} />
      <Route path="drivers/:driverId" element={<DriverDetailRoute basePath="/admin/drivers" />} />
      <Route path="customers" element={<CustomersPage />} />
      <Route path="orders" element={<OrdersPage />} />
      <Route path="*" element={<Navigate to="." replace />} />
    </Routes>
  );
}

export function AnalystHome() {
  return (
    <Routes>
      <Route index element={<ProfileCard role="analyst" />} />
      <Route path="orders" element={<OrdersPage readOnly />} />
      <Route path="fleet" element={<FleetPage readOnly />} />
      <Route path="drivers" element={<DriversPage readOnly basePath="/analyst/drivers" />} />
      <Route path="drivers/:driverId" element={<DriverDetailRoute basePath="/analyst/drivers" />} />
      <Route path="customers" element={<CustomersPage readOnly />} />
      <Route path="exceptions" element={<ExceptionsPage />} />
      <Route path="*" element={<Navigate to="." replace />} />
    </Routes>
  );
}

export function DispatcherHome() {
  return (
    <Routes>
      <Route
        index
        element={
          <div>
            <div className="mx-auto max-w-[1440px] px-4 pt-6">
              <WorkspaceHeader role="dispatcher" />
            </div>
            <DispatcherOpsPage />
          </div>
        }
      />
      <Route path="orders" element={<OrdersPage />} />
      <Route path="deliveries" element={<DispatcherOpsPage />} />
      <Route path="fleet" element={<FleetPage />} />
      <Route path="drivers" element={<DriversPage basePath="/dispatcher/drivers" />} />
      <Route path="drivers/:driverId" element={<DriverDetailRoute basePath="/dispatcher/drivers" />} />
      <Route path="customers" element={<CustomersPage />} />
      <Route path="exceptions" element={<ExceptionsPage />} />
      <Route path="optimize" element={<OptimizePage />} />
      <Route path="realtime-lab" element={<RealtimeTestConsolePage />} />
      <Route path="*" element={<Navigate to="." replace />} />
    </Routes>
  );
}

export function DriverHome() {
  return (
    <Routes>
      <Route
        index
        element={
          <div>
            <div className="mx-auto max-w-[960px] px-4 pt-6">
              <WorkspaceHeader role="driver" />
            </div>
            <DriverOpsPage />
          </div>
        }
      />
      <Route
        path="route"
        element={
          <div>
            <div className="mx-auto max-w-[960px] px-4 pt-6">
              <WorkspaceHeader role="driver" />
            </div>
            <DriverOpsPage />
          </div>
        }
      />
      <Route
        path="vehicle"
        element={
          <div>
            <div className="mx-auto max-w-[960px] px-4 pt-6">
              <WorkspaceHeader role="driver" />
            </div>
            <DriverOpsPage />
          </div>
        }
      />
      <Route path="*" element={<Navigate to="." replace />} />
    </Routes>
  );
}
