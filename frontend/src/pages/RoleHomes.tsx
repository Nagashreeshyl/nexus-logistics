/** Temporary role home placeholders — filled in later milestones with real Firestore UIs. */

export function AdminHome() {
  return (
    <main className="mx-auto max-w-[1440px] px-4 py-8">
      <h1 className="font-sans text-[28px] font-semibold">Admin</h1>
      <p className="mt-2 max-w-[60ch] font-sans text-[14px] text-mute">
        User, driver, and vehicle management will land in v2.5. Role switching and Auth are live in v2.1–v2.3.
        No hardcoded operational counts.
      </p>
      <p className="mt-4 font-mono text-[12px] text-mute">Synthetic data: none until Firestore entities exist.</p>
    </main>
  );
}

export function DispatcherHome() {
  return (
    <main className="mx-auto max-w-[1440px] px-4 py-8">
      <h1 className="font-sans text-[28px] font-semibold">Operations</h1>
      <p className="mt-2 max-w-[60ch] font-sans text-[14px] text-mute">
        Live KPIs, fleet map, and scenario generation arrive with Firestore-backed entities. Use{" "}
        <strong>Optimizer Lab (V1)</strong> for OR-Tools / ML demos until v2.5–v2.6.
      </p>
    </main>
  );
}

export function DriverHome() {
  return (
    <main className="mx-auto max-w-[720px] px-4 py-8">
      <h1 className="font-sans text-[28px] font-semibold">Driver</h1>
      <p className="mt-2 font-sans text-[14px] text-mute">
        Assigned routes and delivery actions will sync from Firestore in v2.7–v2.8. Empty until you are linked to a
        driver profile and route.
      </p>
    </main>
  );
}

export function AnalystHome() {
  return (
    <main className="mx-auto max-w-[1440px] px-4 py-8">
      <h1 className="font-sans text-[28px] font-semibold">Analyst</h1>
      <p className="mt-2 font-sans text-[14px] text-mute">
        Charts will use Firestore-derived history only — no fabricated metrics. Coming in v2.11.
      </p>
    </main>
  );
}
