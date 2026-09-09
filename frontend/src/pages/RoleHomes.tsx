import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { Role, WORKSPACE_IDENTITY } from "../lib/roles";
import { DispatcherOpsPage } from "./DispatcherOpsPage";
import { DriverOpsPage } from "./DriverOpsPage";
import { RealtimeTestConsolePage } from "./RealtimeTestConsolePage";
import { FleetPage } from "./FleetPage";
import { CustomersPage } from "./CustomersPage";
import { DriversPage, DriverDetailPage } from "./DriversPage";
import { OrdersPage } from "./OrdersPage";
import { OptimizePage } from "./OptimizePage";
import { ExceptionsPage } from "./ExceptionsPage";
import { ScenarioStudioPage } from "./ScenarioStudioPage";
import { AnalystDashboardPage } from "./AnalystDashboardPage";
import { AdminDashboardPage } from "./AdminDashboardPage";
import { AdminUsersPage } from "./AdminUsersPage";
import { AdminOrganizationsPage } from "./AdminOrganizationsPage";
import { AdminAuditPage } from "./AdminAuditPage";

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

function DriverDetailRoute({ basePath }: { basePath: string }) {
  const { driverId } = useParams();
  if (!driverId) return <Navigate to={basePath} replace />;
  return <DriverDetailPage driverId={driverId} basePath={basePath} />;
}

export function AdminHome() {
  return (
    <Routes>
      <Route index element={<AdminDashboardPage />} />
      <Route path="fleet" element={<FleetPage />} />
      <Route path="drivers" element={<DriversPage basePath="/admin/drivers" />} />
      <Route path="drivers/:driverId" element={<DriverDetailRoute basePath="/admin/drivers" />} />
      <Route path="customers" element={<CustomersPage />} />
      <Route path="orders" element={<OrdersPage />} />
      <Route path="users" element={<AdminUsersPage />} />
      <Route path="organizations" element={<AdminOrganizationsPage />} />
      <Route path="audit" element={<AdminAuditPage />} />
      <Route path="*" element={<Navigate to="." replace />} />
    </Routes>
  );
}

export function AnalystHome() {
  return (
    <Routes>
      <Route index element={<AnalystDashboardPage />} />
      <Route path="orders" element={<OrdersPage readOnly />} />
      <Route path="deliveries" element={<DispatcherOpsPage />} />
      <Route path="fleet" element={<FleetPage readOnly />} />
      <Route path="drivers" element={<DriversPage readOnly basePath="/analyst/drivers" />} />
      <Route path="drivers/:driverId" element={<DriverDetailRoute basePath="/analyst/drivers" />} />
      <Route path="customers" element={<CustomersPage readOnly />} />
      <Route path="exceptions" element={<ExceptionsPage />} />
      <Route path="performance" element={<AnalystDashboardPage />} />
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
      <Route path="scenarios" element={<ScenarioStudioPage />} />
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
