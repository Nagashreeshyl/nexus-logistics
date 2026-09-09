import { NavLink, Outlet } from "react-router-dom";
import { FileText, Loader2, Play, Sparkles, Zap } from "lucide-react";
import { BrandLogo } from "../../components/BrandLogo";
import { ExportViewer } from "../../components/ExportViewer";
import { LoadingOverlay } from "../../components/LoadingOverlay";
import { WinSheetPanel } from "../../components/WinSheetPanel";
import { fmtClock } from "../../lib/format";
import { useLab } from "./LabSessionContext";
import { LAB_NAV, PLAY_SPEEDS } from "./labTypes";

const btn =
  "inline-flex min-h-9 items-center gap-1.5 border border-hairline bg-snow px-3 py-1.5 font-sans text-[12px] font-semibold text-ink transition hover:border-ink disabled:cursor-not-allowed disabled:opacity-40";

export function LabShell() {
  const lab = useLab();

  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink">
      <LoadingOverlay mode={lab.solving} stageIndex={lab.stage} />
      <WinSheetPanel scenarioId={lab.scenarioId} open={lab.winOpen} onClose={() => lab.setWinOpen(false)} />
      {lab.exportKind && (
        <ExportViewer
          kind={lab.exportKind}
          scenarioId={lab.scenarioId}
          mode={lab.mode}
          onClose={() => lab.setExportKind(null)}
        />
      )}
      {lab.toast && (
        <div className="fixed bottom-5 right-5 z-[1100] max-w-sm border border-ink bg-snow px-4 py-3 font-sans text-[14px] shadow-card">
          {lab.toast}
        </div>
      )}

      <header className="sticky top-0 z-[800] border-b border-hairline bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-3 py-2 sm:px-4">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={lab.onBack} className="flex h-8 w-8 items-center justify-center" aria-label="Back">
              <BrandLogo className="h-8 w-8" />
            </button>
            <p className="hidden font-sans text-[14px] font-semibold sm:block">Nexus Lab</p>

            <nav className="flex flex-wrap gap-1" aria-label="Lab pages">
              {LAB_NAV.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `min-h-8 border px-2.5 py-1 font-sans text-[12px] font-semibold no-underline ${
                      isActive ? "border-ink bg-snow text-ink" : "border-transparent text-mute hover:text-ink"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <button type="button" disabled={lab.busy} onClick={() => void lab.loadNewSynthetic()} className={btn}>
                <Sparkles size={14} />
                {lab.solving === "synthetic" ? "…" : "Load"}
              </button>
              <button
                type="button"
                disabled={lab.busy || lab.scenarioLoading || !lab.scenario}
                onClick={() => void lab.runCompare()}
                className={`inline-flex min-h-9 items-center gap-1.5 bg-coral px-3 font-sans text-[12px] font-semibold disabled:opacity-40 ${
                  lab.solving === "compare" ? "solving-glow" : ""
                }`}
              >
                {lab.solving === "compare" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Optimize
              </button>
              <button
                type="button"
                disabled={lab.busy || !lab.solution}
                onClick={() => lab.setPlaying(true)}
                className={`${btn} w-[5.5rem] shrink-0 justify-center gap-1.5`}
                aria-label={lab.playMin != null ? `Play day ${fmtClock(lab.playMin)}` : "Play day"}
              >
                <Play size={14} className="shrink-0" />
                <span className="inline-block w-[2.75rem] text-left font-mono text-[12px] tabular-nums">
                  {lab.playMin != null ? fmtClock(lab.playMin) : "Play"}
                </span>
              </button>
              <div className="hidden overflow-hidden border border-hairline sm:flex" role="group" aria-label="Speed">
                {PLAY_SPEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={lab.busy || !lab.solution}
                    onClick={() => {
                      lab.setPlaySpeed(s);
                      if (lab.playing) {
                        lab.setPlaying(false);
                        window.requestAnimationFrame(() => lab.setPlaying(true));
                      }
                    }}
                    className={`min-h-9 px-1.5 font-mono text-[10px] font-semibold ${
                      lab.playSpeed === s ? "bg-ink text-snow" : "bg-snow text-mute"
                    }`}
                  >
                    {s}×
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={lab.busy || !lab.scenario}
                onClick={() => void lab.injectRushOrder()}
                className={btn}
              >
                <Zap size={14} /> Rush
              </button>
              <button type="button" disabled={lab.busy} onClick={() => lab.setWinOpen(true)} className={btn}>
                <FileText size={14} /> Win
              </button>
            </div>
          </div>

          <p className="font-mono text-[11px] text-mute">
            {lab.scenarioLoading
              ? "Loading…"
              : `${lab.orderCount} stops · ${lab.vanCount} vans · ${lab.criticalCount} crit`}
            {lab.solution
              ? ` · ${lab.solution.feasible && !lab.solution.partial ? "feasible" : "partial"} · risk ${lab.highRiskCount}`
              : " · not optimized"}
            {` · ${lab.weatherLabel} · ${lab.clockLabel}`}
            {lab.cacheMode ? ` · cache ${lab.cacheMode}` : ""}
          </p>

          {lab.error && (
            <div className="flex items-center justify-between border border-coral bg-snow px-3 py-2 font-sans text-[13px] text-coral">
              <span>{lab.error}</span>
              <button type="button" className="underline" onClick={() => lab.setError(null)}>
                Dismiss
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-3 py-4 sm:px-4">
        <Outlet />
      </main>
    </div>
  );
}
