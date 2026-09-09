import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { HackathonShell } from "./components/HackathonShell";
import { AppShell } from "./components/AppShell";
import { RequireAuth, RequireRole } from "./components/RequireAuth";
import { AuthProvider } from "./firebase/AuthProvider";
import { LandingPage } from "./pages/LandingPage";
import { PresentationPage } from "./pages/PresentationPage";
import { OptimizerLabPage } from "./pages/OptimizerLabPage";
import { LoginPage } from "./pages/LoginPage";
import { UnauthorizedPage } from "./pages/UnauthorizedPage";
import { AdminHome, AnalystHome, DispatcherHome, DriverHome } from "./pages/RoleHomes";

/**
 * Primary UX: Presentation + V1 Optimizer Lab (Console).
 * /optimizer is the main-branch Lab experience (light console).
 * Legacy ops workspaces kept for deep links — not in primary nav.
 */
export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<HackathonShell />}>
            <Route index element={<LandingPage />} />
            <Route path="presentation" element={<PresentationPage />} />
          </Route>

          {/* Full-page V1 Lab — outside shell so chrome matches main */}
          <Route path="/optimizer" element={<OptimizerLabPage />} />
          <Route path="/lab" element={<Navigate to="/optimizer" replace />} />
          <Route path="/login" element={<LoginPage />} />

          <Route element={<RequireAuth />}>
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            <Route element={<AppShell />}>
              <Route element={<RequireRole role="admin" />}>
                <Route path="/admin/*" element={<AdminHome />} />
              </Route>
              <Route element={<RequireRole role="dispatcher" />}>
                <Route path="/dispatcher/*" element={<DispatcherHome />} />
              </Route>
              <Route element={<RequireRole role="driver" />}>
                <Route path="/driver/*" element={<DriverHome />} />
              </Route>
              <Route element={<RequireRole role="analyst" />}>
                <Route path="/analyst/*" element={<AnalystHome />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
