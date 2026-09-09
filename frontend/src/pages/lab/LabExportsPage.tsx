import { Cloud, Download, Map as MapIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { useLab } from "./LabSessionContext";

export function LabExportsPage() {
  const lab = useLab();

  return (
    <div className="flex flex-col gap-4">
      <section className="border border-hairline bg-snow px-4 py-4">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-mute">Exports</p>
        <h1 className="mt-1 font-sans text-[22px] font-semibold">Driver sheet · map · weather</h1>
        <p className="mt-1 font-sans text-[14px] text-mute">
          Downloads use the current scenario and plan mode. When the demo is done, return to the presentation Thank you
          slide.
        </p>
      </section>

      <Link
        to="/presentation?slide=6"
        className="flex items-center justify-center bg-coral px-4 py-4 font-sans text-[15px] font-semibold text-ink"
      >
        Back to presentation · Thank you →
      </Link>

      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          disabled={lab.busy}
          onClick={() => lab.setExportKind("csv")}
          className="flex flex-col items-start gap-2 border border-hairline bg-snow px-4 py-4 text-left hover:border-ink disabled:opacity-40"
        >
          <Download size={18} />
          <span className="font-sans text-[15px] font-semibold">Driver sheet</span>
          <span className="font-sans text-[12px] text-mute">Clean CSV / printable preview</span>
        </button>
        <button
          type="button"
          disabled={lab.busy}
          onClick={() => lab.setExportKind("geojson")}
          className="flex flex-col items-start gap-2 border border-hairline bg-snow px-4 py-4 text-left hover:border-ink disabled:opacity-40"
        >
          <MapIcon size={18} />
          <span className="font-sans text-[15px] font-semibold">Map export</span>
          <span className="font-sans text-[12px] text-mute">GeoJSON for GIS tools</span>
        </button>
        <button
          type="button"
          disabled={lab.busy}
          onClick={() => void lab.onWeather()}
          className="flex flex-col items-start gap-2 border border-hairline bg-snow px-4 py-4 text-left hover:border-ink disabled:opacity-40"
        >
          <Cloud size={18} />
          <span className="font-sans text-[15px] font-semibold">Refresh weather</span>
          <span className="font-sans text-[12px] text-mute">{lab.weatherLabel}</span>
        </button>
      </div>

      <p className="font-mono text-[12px] text-mute">
        mode {lab.mode} · scenario {lab.scenarioId}
        {lab.solution ? ` · travel ${lab.solution.travel_source}` : ""}
      </p>
    </div>
  );
}
