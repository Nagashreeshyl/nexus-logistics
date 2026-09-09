import { useNavigate, useSearchParams } from "react-router-dom";
import { OptimizerLabWorkbench } from "./OptimizerLabWorkbench";

/**
 * Hackathon Optimizer Lab — synthetic scenario → real OR-Tools + risk → breakdown reopt.
 * Preserves presentation return-slide deep links.
 */
export function OptimizerLabPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = params.get("returnTo") || "/presentation?slide=7";
  const fromSlide = Number(params.get("fromSlide") || "") || undefined;

  return (
    <OptimizerLabWorkbench
      returnTo={returnTo}
      fromSlide={fromSlide}
      onBack={() => navigate(returnTo)}
    />
  );
}
