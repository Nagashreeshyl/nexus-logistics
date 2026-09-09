import { Navigate, Route, Routes, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { writeLabSession } from "../lib/labSession";
import { LabProvider } from "./lab/LabSessionContext";
import { LabShell } from "./lab/LabShell";
import { LabOverviewPage } from "./lab/LabOverviewPage";
import { LabScenarioPage } from "./lab/LabScenarioPage";
import { LabPlanPage } from "./lab/LabPlanPage";
import { LabRiskPage } from "./lab/LabRiskPage";
import { LabExceptionsPage } from "./lab/LabExceptionsPage";
import { LabEvidencePage } from "./lab/LabEvidencePage";
import { LabExportsPage } from "./lab/LabExportsPage";
import { LabAnalyticsPage } from "./lab/LabAnalyticsPage";

/**
 * Multi-page Optimizer Lab — shared LabProvider state across routes.
 */
export function OptimizerLabPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = params.get("returnTo") || "/";
  const fromSlide = Number(params.get("fromSlide") || "") || undefined;

  useEffect(() => {
    writeLabSession({
      returnTo,
      slide: fromSlide && fromSlide >= 1 && fromSlide <= 6 ? fromSlide : undefined,
    });
  }, [returnTo, fromSlide]);

  return (
    <LabProvider onBack={() => navigate(returnTo)}>
      <Routes>
        <Route element={<LabShell />}>
          <Route index element={<LabOverviewPage />} />
          <Route path="scenario" element={<LabScenarioPage />} />
          <Route path="plan" element={<LabPlanPage />} />
          <Route path="risk" element={<LabRiskPage />} />
          <Route path="exceptions" element={<LabExceptionsPage />} />
          <Route path="analytics" element={<LabAnalyticsPage />} />
          <Route path="evidence" element={<LabEvidencePage />} />
          <Route path="exports" element={<LabExportsPage />} />
          <Route path="*" element={<Navigate to="/optimizer" replace />} />
        </Route>
      </Routes>
    </LabProvider>
  );
}
