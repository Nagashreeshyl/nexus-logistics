import { useState } from "react";
import { useAuth } from "../firebase/AuthProvider";
import { OpsPageShell } from "../components/ops/OpsPageShell";
import { useToast } from "../components/ops/useToast";
import { generateOperationalScenario } from "../services/firestore/entityCrud";
import { collection, getDocs, query, where, writeBatch, doc, limit } from "firebase/firestore";
import { getFirebase } from "../firebase/config";

const PRESETS: Record<
  string,
  { vehicles: number; drivers: number; customers: number; orders: number; seed: number; blurb: string }
> = {
  "Normal Day": { vehicles: 4, drivers: 4, customers: 12, orders: 16, seed: 101, blurb: "Balanced day" },
  "Busy Day": { vehicles: 6, drivers: 6, customers: 20, orders: 30, seed: 202, blurb: "High volume" },
  "High Priority Day": { vehicles: 5, drivers: 5, customers: 15, orders: 22, seed: 303, blurb: "Many criticals" },
  "Vehicle Breakdown": { vehicles: 5, drivers: 5, customers: 12, orders: 18, seed: 404, blurb: "Then mark a vehicle BREAKDOWN" },
  "Late Delivery Risk": { vehicles: 4, drivers: 4, customers: 14, orders: 20, seed: 505, blurb: "Tight windows" },
  "Capacity Stress": { vehicles: 3, drivers: 3, customers: 18, orders: 28, seed: 606, blurb: "Demand near fleet capacity" },
  "Time Window Stress": { vehicles: 4, drivers: 4, customers: 16, orders: 24, seed: 707, blurb: "Overlapping windows" },
  "Mixed Crisis": { vehicles: 5, drivers: 5, customers: 20, orders: 32, seed: 808, blurb: "Volume + risk + tight windows" },
};

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms (Firestore may be rate-limited, wait and retry)`));
    }, ms);
    promise.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (err) => {
        window.clearTimeout(t);
        reject(err);
      },
    );
  });
}

export function ScenarioStudioPage() {
  const { profile, firebaseUser } = useAuth();
  const { show, toastEl } = useToast();
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  function push(msg: string) {
    setLog((prev) => [...prev, msg]);
  }

  async function generate(name: string) {
    if (!profile || !firebaseUser) return;
    const preset = PRESETS[name];
    setSelectedPreset(name);
    setBusy(true);
    setReady(false);
    setLog([]);
    try {
      const actor = { uid: firebaseUser.uid, email: profile.email, organizationId: profile.organizationId };
      await withTimeout(
        generateOperationalScenario(actor, preset, firebaseUser.uid, (msg) => push(msg)),
        180_000,
        "Scenario generate",
      );
      push("Calculating risk happens on Optimize…");
      setReady(true);
      push("SCENARIO READY");
      show(`${name} published (synthetic)`);
    } catch (e) {
      show(e instanceof Error ? e.message : String(e), "err");
      push("FAILED");
    } finally {
      setBusy(false);
    }
  }

  async function resetSynthetic() {
    if (!profile) return;
    if (!window.confirm("Delete synthetic operational records for this organization only?")) return;
    setBusy(true);
    setLog(["Resetting synthetic docs…"]);
    try {
      const fb = getFirebase();
      if (!fb.configured) throw new Error(fb.reason);
      // Org-scoped query only (auto single-field index). Filter synthetic client-side.
      // Paginate with limit so a hung/unbounded getDocs cannot freeze the demo forever.
      const cols = [
        "vehicles",
        "drivers",
        "customers",
        "orders",
        "deliveries",
        "exceptions",
        "routes",
        "stops",
      ];
      let deleted = 0;
      for (const name of cols) {
        try {
          push(`Scanning ${name}…`);
          let rounds = 0;
          let removedInCol = 0;
          while (rounds < 40) {
            rounds += 1;
            const snap = await withTimeout(
              getDocs(
                query(
                  collection(fb.db, name),
                  where("organizationId", "==", profile.organizationId),
                  limit(40),
                ),
              ),
              45_000,
              `Scan ${name}`,
            );
            if (snap.empty) break;
            const syntheticDocs = snap.docs.filter((d) => d.data().synthetic === true);
            if (syntheticDocs.length === 0) {
              // Page had only non-synthetic docs — stop to avoid infinite re-scan of the same page.
              push(`${name}: no more synthetic in page (left ${snap.size} non-synthetic)`);
              break;
            }
            const batch = writeBatch(fb.db);
            syntheticDocs.forEach((d) => {
              batch.delete(doc(fb.db, name, d.id));
              deleted += 1;
              removedInCol += 1;
            });
            await withTimeout(batch.commit(), 45_000, `Delete ${name} batch`);
          }
          if (removedInCol) push(`Deleted ${removedInCol} from ${name}`);
        } catch (colErr) {
          push(`FAILED ${name}: ${colErr instanceof Error ? colErr.message : String(colErr)}`);
          // Continue other collections instead of aborting the entire reset.
        }
      }
      show(`Removed ${deleted} synthetic docs`);
      setReady(false);
      push(`Reset complete · deleted ${deleted}`);
    } catch (e) {
      show(e instanceof Error ? e.message : String(e), "err");
      push(`FAILED: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <OpsPageShell
      title="Synthetic Scenario Engine"
      subtitle="One-click demo scenarios write through the same Firestore repositories as real ops data. Deterministic seeds keep the hackathon demo reliable."
      connection="live"
      actions={
        <button type="button" disabled={busy} className="rounded-xl border border-coral px-3 py-2 font-sans text-[13px] font-semibold text-coral" onClick={() => void resetSynthetic()}>
          Reset Demo Scenario
        </button>
      }
    >
      {toastEl}
      <section className="mt-6 grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-ink bg-ink p-5 text-snow">
          <p className="font-sans text-[12px] font-medium uppercase tracking-[0.08em] text-snow/70">Quick flow</p>
          <ol className="mt-3 space-y-3 font-sans text-[14px] leading-6 text-snow/80">
            <li>1. Pick a preset that matches your demo story.</li>
            <li>2. Wait for all synthetic writes to finish.</li>
            <li>3. Open Optimize or Operations and confirm the scenario appears live.</li>
          </ol>
        </div>
        <div className="rounded-2xl border border-hairline bg-snow p-5">
          <p className="font-sans text-[12px] font-medium uppercase tracking-[0.08em] text-mute">Current selection</p>
          <p className="mt-2 font-sans text-[18px] font-semibold text-ink">{selectedPreset ?? "No preset selected"}</p>
          <p className="mt-2 font-sans text-[13px] leading-6 text-mute">
            Use Normal Day for a stable demo, Busy Day for route pressure, and Mixed Crisis for the hardest narrative.
          </p>
        </div>
      </section>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(PRESETS).map(([name, preset]) => (
          <button
            key={name}
            type="button"
            disabled={busy}
            className={`rounded-2xl border p-4 text-left transition hover:border-ink disabled:opacity-40 ${
              selectedPreset === name ? "border-ink bg-paper" : "border-hairline bg-snow"
            }`}
            onClick={() => void generate(name)}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-sans text-[15px] font-semibold text-ink">{name}</p>
                <p className="mt-1 font-sans text-[12px] text-mute">{preset.blurb}</p>
              </div>
              <span className="rounded-full border border-hairline px-2 py-1 font-mono text-[10px] text-mute">seed {preset.seed}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-[11px] text-mute">
              <span>{preset.vehicles} vans</span>
              <span>{preset.drivers} drivers</span>
              <span>{preset.customers} customers</span>
              <span>{preset.orders} orders</span>
            </div>
            <p className="mt-4 font-sans text-[13px] font-semibold text-coral">
              {busy && selectedPreset === name ? "Publishing…" : "Generate scenario"}
            </p>
           </button>
        ))}
      </div>
      <div className="mt-6 rounded-2xl border border-hairline bg-snow p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-sans text-[16px] font-semibold text-ink">Progress</p>
            <p className="mt-1 font-sans text-[13px] text-mute">Each write step is logged here so you can tell whether the scenario is still running or stuck.</p>
          </div>
          {selectedPreset ? <span className="rounded-full border border-hairline px-2 py-1 font-mono text-[11px] text-mute">{selectedPreset}</span> : null}
        </div>
        <ul className="mt-4 space-y-2 font-mono text-[12px] text-mute">
          {log.map((l) => (
            <li key={l} className="rounded-xl bg-paper px-3 py-2">{l}</li>
          ))}
        </ul>
        {!log.length && <p className="mt-4 font-sans text-[13px] text-mute">Pick a preset to start the scenario flow.</p>}
        {ready && <p className="mt-4 font-sans text-[14px] font-semibold text-ink">Scenario ready. Open Optimize or Operations next.</p>}
      </div>
    </OpsPageShell>
  );
}
