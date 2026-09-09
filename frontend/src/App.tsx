import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { RequireAuth, RequireRole } from "./components/RequireAuth";
import { AuthProvider } from "./firebase/AuthProvider";
import { LoginPage } from "./pages/LoginPage";
import { AdminHome, AnalystHome, DispatcherHome, DriverHome } from "./pages/RoleHomes";
import { Console } from "./pages/Console";

function LabPage() {
  return <Console onBack={() => window.history.back()} />;
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/lab" element={<LabPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="/dispatcher" replace />} />
              <Route element={<RequireRole role="admin" />}>
                <Route path="/admin" element={<AdminHome />} />
              </Route>
              <Route element={<RequireRole role="dispatcher" />}>
                <Route path="/dispatcher" element={<DispatcherHome />} />
              </Route>
              <Route element={<RequireRole role="driver" />}>
                <Route path="/driver" element={<DriverHome />} />
              </Route>
              <Route element={<RequireRole role="analyst" />}>
                <Route path="/analyst" element={<AnalystHome />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
