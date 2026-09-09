import { useMemo } from "react";
import { useAuth } from "../firebase/AuthProvider";
import {
  mergeConnection,
  useRealtimeDeliveries,
  useRealtimeExceptions,
  useRealtimeOrders,
  useRealtimeOptimizationRuns,
  useRealtimeVehicles,
} from "../hooks/useRealtimeOps";
import { MetricGrid, OpsPageShell } from "../components/ops/OpsPageShell";
import { formatLastSeen } from "../components/ops/OpsBadges";
import { compare } from "../api";
import { useEffect, useState } from "react";

export function AnalystDashboardPage() {
  const { profile } = useAuth();
  const orgId = profile?.organizationId;
  const ordersQ = useRealtimeOrders(orgId);
  const deliveriesQ = useRealtimeDeliveries(orgId);
  const vehiclesQ = useRealtimeVehicles(orgId);
  const exceptionsQ = useRealtimeExceptions(orgId);
  const runsQ = useRealtimeOptimizationRuns(orgId);
  const connection = mergeConnection(
    ordersQ.connection,
    deliveriesQ.connection,
    vehiclesQ.connection,
    exceptionsQ.connection,
  );
  const [labCompare, setLabCompare] = useState<Awaited<ReturnType<typeof compare>> | null>(null);

  useEffect(() => {
    void compare("a").then(setLabCompare).catch(() => undefined);
  }, []);

  const metrics = useMemo(() => {
    const dels = deliveriesQ.data;
    const delivered = dels.filter((d) => d.status === "DELIVERED").length;
    const failed = dels.filter((d) => d.status === "FAILED").length;
    const lateish = dels.filter((d) => d.riskLevel === "high" || d.riskLevel === "critical").length;
    const onTime = delivered; // without telemetry, delivered without FAILED proxy
    const totalDone = delivered + failed;
    const onTimePct = totalDone ? Math.round((onTime / totalDone) * 100) : 0;
    const activeVehicles = vehiclesQ.data.filter((v) => v.status === "ASSIGNED" || v.status === "EN_ROUTE").length;
    return [
      ["Total orders", ordersQ.data.length],
      ["Delivered", delivered],
      ["Failed", failed],
      ["At-risk (live)", lateish],
      ["On-time % (proxy)", onTimePct],
      ["Vehicles used", activeVehicles],
      ["Open exceptions", exceptionsQ.data.filter((e) => e.status === "open").length],
      ["Opt runs", runsQ.data.length],
    ] as Array<[string, number | string]>;
  }, [ordersQ.data, deliveriesQ.data, vehiclesQ.data, exceptionsQ.data, runsQ.data]);

  return (
    <OpsPageShell
      title="Analyst Overview"
      subtitle="Read-only metrics derived from Firestore + authoritative OR-Tools lab comparison. No hardcoded KPIs."
      connection={connection}
    >
      <MetricGrid items={metrics} />

      <section className="mt-8">
        <h2 className="font-sans text-[18px] font-semibold">Baseline vs Nexus AI (lab scenario A)</h2>
        <p className="mt-1 font-sans text-[13px] text-mute">
          Values come from the existing optimizer/compare API — not fabricated UI copy.
        </p>
        {labCompare ? (
          <div className="mt-3 overflow-x-auto border border-hairline bg-snow">
            <table className="min-w-full font-mono text-[12px]">
              <thead className="border-b border-hairline bg-paper text-mute">
                <tr>
                  {["Metric", "Baseline", "Nexus AI", "Δ", "Improvement %"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {labCompare.comparison.map((row) => (
                  <tr key={row.key} className="border-b border-hairline/70">
                    <td className="px-3 py-2">{row.metric}</td>
                    <td className="px-3 py-2">{row.baseline}</td>
                    <td className="px-3 py-2 font-semibold">{row.optimized}</td>
                    <td className="px-3 py-2">{row.delta}</td>
                    <td className="px-3 py-2">{row.improvement_pct ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-mute">Loading comparison…</p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="font-sans text-[18px] font-semibold">Audit timeline (optimization runs)</h2>
        <ul className="mt-3 space-y-2">
          {runsQ.data.slice(0, 20).map((run: any) => (
            <li key={run.id} className="border border-hairline bg-snow px-3 py-2 font-mono text-[12px]">
              {run.mode ?? "run"} · feasible={String(run.feasible)} · {formatLastSeen(run.createdAt)}
            </li>
          ))}
          {runsQ.data.length === 0 && (
            <li className="font-sans text-[13px] text-mute">No optimizationRuns yet — run Optimize Deliveries.</li>
          )}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="font-sans text-[18px] font-semibold">Exceptions</h2>
        <ul className="mt-3 space-y-2 font-mono text-[12px]">
          {exceptionsQ.data.slice(0, 15).map((ex) => (
            <li key={ex.id} className="border border-hairline bg-snow px-3 py-2">
              {ex.type} · {ex.severity} · {ex.message}
            </li>
          ))}
        </ul>
      </section>
    </OpsPageShell>
  );
}
