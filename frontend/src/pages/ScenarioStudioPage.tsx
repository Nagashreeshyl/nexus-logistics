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
      reject(new Error(`${label} timed out after ${ms}ms (Firestore may be rate-limited — wait and retry)`));
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

  function push(msg: string) {
    setLog((prev) => [...prev, msg]);
  }

  async function generate(name: string) {
    if (!profile || !firebaseUser) return;
    const preset = PRESETS[name];
    setBusy(true);
    setReady(false);
    setLog([]);
    try {
      const actor = { uid: firebaseUser.uid, email: profile.email, organizationId: profile.organizationId };
      push("Generating fleet…");
      push("Generating drivers…");
      push("Generating customers…");
      push("Generating orders…");
      await generateOperationalScenario(actor, preset, firebaseUser.uid);
      push("Publishing scenario to Firestore…");
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
                limit(80),
              ),
            ),
            12_000,
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
          await withTimeout(batch.commit(), 12_000, `Delete ${name} batch`);
        }
        if (removedInCol) push(`Deleted ${removedInCol} from ${name}`);
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
        <button type="button" disabled={busy} className="border border-coral px-3 py-2 font-sans text-[13px] font-semibold text-coral" onClick={() => void resetSynthetic()}>
          Reset Demo Scenario
        </button>
      }
    >
      {toastEl}
      <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(PRESETS).map(([name, preset]) => (
          <button
            key={name}
            type="button"
            disabled={busy}
            className="border border-hairline bg-snow p-4 text-left hover:border-ink disabled:opacity-40"
            onClick={() => void generate(name)}
          >
            <p className="font-sans text-[14px] font-semibold">Generate Demo Scenario</p>
            <p className="mt-1 font-sans text-[13px] font-semibold text-ink">{name}</p>
            <p className="mt-1 font-sans text-[12px] text-mute">{preset.blurb}</p>
            <p className="mt-2 font-mono text-[11px] text-mute">
              {preset.vehicles}v · {preset.drivers}d · {preset.customers}c · {preset.orders}o · seed {preset.seed}
            </p>
          </button>
        ))}
      </div>
      <div className="mt-6 border border-hairline bg-snow p-4 font-mono text-[12px]">
        <p className="sys">Progress</p>
        <ul className="mt-2 space-y-1 text-mute">
          {log.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        {ready && <p className="mt-3 font-sans text-[14px] font-semibold text-ink">SCENARIO READY — open Optimize / Dispatcher</p>}
      </div>
    </OpsPageShell>
  );
}
