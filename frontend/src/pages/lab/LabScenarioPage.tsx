import { OrderBoard } from "../../components/OrderBoard";
import { useLab } from "./LabSessionContext";
import { ARCHETYPE_OPTIONS } from "./labTypes";

export function LabScenarioPage() {
  const lab = useLab();

  return (
    <div className="flex flex-col gap-4">
      <section className="border border-hairline bg-snow px-4 py-4">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-mute">Scenario</p>
        <h1 className="mt-1 font-sans text-[22px] font-semibold">Day packs & synthetic archetypes</h1>
        <p className="mt-1 font-sans text-[14px] text-mute">
          Same engines for Day A/B and Lab synthetic. Each Load creates a new Bengaluru day.
        </p>

        <div className="mt-4 flex flex-wrap overflow-hidden border border-hairline" role="group">
          <button
            type="button"
            onClick={() => lab.setScenarioId("a")}
            className={`min-h-11 px-4 font-sans text-[13px] font-semibold ${
              lab.scenarioId === "a" ? "bg-ink text-snow" : "bg-snow text-mute hover:text-ink"
            }`}
          >
            Day A · Normal
          </button>
          <button
            type="button"
            onClick={() => lab.setScenarioId("b")}
            className={`min-h-11 px-4 font-sans text-[13px] font-semibold ${
              lab.scenarioId === "b" ? "bg-coral text-ink" : "bg-snow text-mute hover:text-ink"
            }`}
          >
            Day B · Overloaded
          </button>
          <button
            type="button"
            disabled={lab.busy}
            onClick={() => void lab.loadNewSynthetic()}
            className={`min-h-11 border-l border-hairline px-4 font-sans text-[13px] font-semibold disabled:opacity-40 ${
              lab.isLab ? "bg-coral text-ink" : "bg-snow text-mute hover:text-ink"
            }`}
          >
            {lab.solving === "synthetic" ? "Generating…" : lab.isLab ? "Reload synthetic" : "Load Scenario"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {ARCHETYPE_OPTIONS.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={lab.busy}
              title={a.hint}
              onClick={() => void lab.loadNewSynthetic(a.id)}
              className={`min-h-9 border px-3 font-sans text-[12px] font-semibold ${
                lab.archetype === a.id ? "border-ink bg-paper" : "border-hairline text-mute hover:border-ink"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>

        <p className="mt-3 font-mono text-[12px] text-mute">
          id <span className="text-ink">{lab.scenarioId}</span>
          {lab.labGenerationId ? ` · ${lab.labGenerationId}` : ""} · {lab.orderCount} orders · {lab.vanCount} vans ·{" "}
          {lab.criticalCount} critical
        </p>
      </section>

      {lab.scenario && (
        <OrderBoard
          orders={lab.scenario.orders}
          solution={lab.solution}
          selectedId={lab.selectedId}
          onSelect={lab.setSelectedId}
        />
      )}
    </div>
  );
}
