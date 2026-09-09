import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Console } from "./Console";

/**
 * V1 Optimizer Lab (Console) — light Agency workbench.
 * Preserves presentation return-slide deep links.
 */
export function OptimizerLabPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = params.get("returnTo") || "/presentation?slide=7";

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <div className="flex items-center justify-between gap-3 border-b border-hairline bg-snow px-4 py-2.5 sm:px-6">
        <button
          type="button"
          onClick={() => navigate(returnTo)}
          className="font-sans text-[13px] font-semibold text-mute hover:text-ink"
        >
          ← Back to Presentation
        </button>
        <div className="flex items-center gap-3">
          <Link to="/presentation" className="font-sans text-[13px] font-semibold text-mute hover:text-ink">
            Presentation
          </Link>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-mute">V1 Optimizer Lab</span>
        </div>
      </div>
      <Console onBack={() => navigate(returnTo)} />
    </div>
  );
}
