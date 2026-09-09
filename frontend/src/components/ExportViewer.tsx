import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, X } from "lucide-react";
import { geojsonUrl, manifestUrl } from "../api";
import type { SolveMode } from "../types";
import { fmtClock } from "../lib/format";

export type ExportKind = "csv" | "geojson";

interface ExportViewerProps {
  kind: ExportKind;
  scenarioId: string;
  mode: SolveMode;
  onClose: () => void;
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map(splitCsvLine);
  return { headers, rows };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = !q;
      continue;
    }
    if (ch === "," && !q) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportViewer({ kind, scenarioId, mode, onClose }: ExportViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [csvText, setCsvText] = useState("");
  const [geo, setGeo] = useState<{
    type: string;
    features: { type: string; properties: Record<string, unknown>; geometry: { type: string } }[];
  } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const url = kind === "csv" ? manifestUrl(scenarioId, mode) : geojsonUrl(scenarioId, mode);
    fetch(url)
      .then(async (r) => {
        const text = await r.text();
        if (!r.ok || text.includes("NOT_FOUND")) {
          if (r.status === 404 || text.includes("NOT_FOUND")) {
            throw new Error(
              "API offline — Map/Driver exports need the FastAPI backend (VITE_API_BASE_URL).",
            );
          }
          throw new Error(text.slice(0, 200) || r.statusText || "Failed to load export");
        }
        if (kind === "csv") return { csv: text, geo: null };
        return { csv: "", geo: JSON.parse(text) };
      })
      .then((payload) => {
        if (cancelled) return;
        if (kind === "csv") setCsvText(payload.csv);
        else setGeo(payload.geo);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message || "Failed to load export");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, scenarioId, mode]);

  const table = useMemo(() => parseCsv(csvText), [csvText]);
  const counts = useMemo(() => {
    if (!geo) return null;
    const kinds = { route: 0, stop: 0, deferred: 0, depot: 0 };
    for (const f of geo.features) {
      const k = String(f.properties.kind || "");
      if (k in kinds) kinds[k as keyof typeof kinds] += 1;
    }
    return kinds;
  }, [geo]);

  const title = kind === "csv" ? "Driver manifesto" : "Route GeoJSON";
  const subtitle =
    kind === "csv"
      ? `Scenario ${scenarioId.toUpperCase()} · ${mode} · printable stop sheet`
      : `Scenario ${scenarioId.toUpperCase()} · ${mode} · GIS FeatureCollection`;

  const onDownload = () => {
    if (kind === "csv") {
      downloadBlob(`nexus-manifest-${scenarioId}-${mode}.csv`, new Blob([csvText], { type: "text/csv" }));
    } else if (geo) {
      downloadBlob(
        `nexus-routes-${scenarioId}-${mode}.geojson`,
        new Blob([JSON.stringify(geo, null, 2)], { type: "application/geo+json" }),
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-ink/40 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="flex max-h-[90dvh] w-full max-w-5xl flex-col border border-ink bg-snow shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline px-5 py-4">
          <div>
            <p className="sys text-mute">Sys.export // {kind}</p>
            <h2 className="mt-1 font-display text-[28px] font-medium text-ink">{title}</h2>
            <p className="mt-1 font-mono text-[12px] text-mute">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading || Boolean(error)}
              onClick={onDownload}
              className="inline-flex min-h-11 items-center gap-2 border border-ink bg-coral px-4 py-2 font-mono text-[11px] font-semibold uppercase text-snow disabled:opacity-40"
            >
              <Download size={14} />
              Download
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 items-center justify-center border border-hairline text-mute hover:border-ink hover:text-ink"
              aria-label="Close export viewer"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-5">
          {loading && (
            <div className="flex items-center gap-3 font-mono text-[13px] text-mute">
              <Loader2 className="h-4 w-4 animate-spin text-coral" />
              Building export from live plan…
            </div>
          )}
          {error && <p className="font-mono text-[13px] text-coral">{error}</p>}

          {!loading && !error && kind === "csv" && (
            <div className="overflow-auto border border-hairline">
              <table className="w-full min-w-[960px] text-left text-[12px]">
                <thead className="sticky top-0 bg-paper font-mono text-[10px] uppercase tracking-wide text-mute">
                  <tr>
                    {table.headers.map((h) => (
                      <th key={h} className="border-b border-hairline px-3 py-2 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, i) => (
                    <tr key={i} className="border-t border-hairline hover:bg-lavender/70">
                      {row.map((cell, j) => {
                        const key = table.headers[j];
                        let display = cell;
                        if ((key === "eta" || key === "window_end") && cell !== "" && !Number.isNaN(Number(cell))) {
                          display = fmtClock(Number(cell));
                        }
                        if (key === "late") display = cell === "True" || cell === "true" ? "LATE" : "OK";
                        return (
                          <td
                            key={`${i}-${j}`}
                            className={`px-3 py-2 align-top ${
                              key === "late" && display === "LATE" ? "font-mono text-coral" : "text-ink"
                            } ${key === "customer" || key === "address" ? "max-w-[220px]" : "font-mono text-[11px]"}`}
                          >
                            {display || "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {!table.rows.length && (
                <p className="p-4 font-mono text-[12px] text-mute">No rows — run a plan first.</p>
              )}
            </div>
          )}

          {!loading && !error && kind === "geojson" && geo && (
            <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
              <aside className="border border-hairline bg-paper p-4">
                <p className="sys text-ink">Feature counts</p>
                <dl className="mt-3 space-y-2 font-mono text-[12px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-mute">Depot</dt>
                    <dd className="text-ink">{counts?.depot ?? 0}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-mute">Routes</dt>
                    <dd className="text-ink">{counts?.route ?? 0}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-mute">Stops</dt>
                    <dd className="text-ink">{counts?.stop ?? 0}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-mute">Deferred</dt>
                    <dd className="text-ink">{counts?.deferred ?? 0}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-hairline pt-2">
                    <dt className="text-mute">Total features</dt>
                    <dd className="text-ink">{geo.features.length}</dd>
                  </div>
                </dl>
                <p className="mt-4 font-mono text-[11px] leading-relaxed text-mute">
                  Standard GeoJSON FeatureCollection for QGIS, Mapbox, or MapLibre. Coordinates are lon/lat.
                </p>
              </aside>
              <div className="overflow-auto border border-hairline bg-[#1a1008] p-4">
                <pre className="font-mono text-[11px] leading-relaxed text-[#E8E4DC]">
                  {JSON.stringify(geo, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
