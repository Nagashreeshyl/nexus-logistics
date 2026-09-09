import { LiveSyncBadge } from "./OpsBadges";
import type { SyncConnectionState } from "../../lib/opsTypes";
import type { ReactNode } from "react";

export function OpsPageShell({
  title,
  subtitle,
  connection,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  connection: SyncConnectionState;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-[1440px] px-4 py-6">
      <div className="rounded-2xl border border-hairline bg-snow p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="sys text-coral">Operations workspace</p>
            <h1 className="mt-2 font-sans text-[28px] font-semibold tracking-[-0.02em] text-ink">{title}</h1>
            {subtitle ? <p className="mt-2 max-w-[72ch] font-sans text-[14px] leading-6 text-mute">{subtitle}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LiveSyncBadge connection={connection} />
            {actions}
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-sans text-[13px] font-semibold text-ink">What to do next</p>
          <p className="mt-1 max-w-[68ch] font-sans text-[13px] leading-5 text-mute">
            Review readiness, complete one primary action, then confirm the result in the live board below.
          </p>
        </div>
      </div>
      {children}
    </main>
  );
}

export function MetricGrid({ items }: { items: Array<[string, number | string]> }) {
  return (
    <section className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-hairline bg-snow px-4 py-4">
          <p className="font-sans text-[12px] font-medium uppercase tracking-[0.08em] text-mute">{label}</p>
          <p className="mt-2 font-mono text-[22px] font-semibold tabular text-ink">{value}</p>
        </div>
      ))}
    </section>
  );
}

export function SearchFilterBar({
  search,
  onSearch,
  placeholder,
  children,
}: {
  search: string;
  onSearch: (v: string) => void;
  placeholder?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder={placeholder ?? "Search…"}
        className="min-w-[220px] flex-1 rounded-xl border border-hairline bg-paper px-3 py-2.5 font-mono text-[13px] outline-none transition focus:border-ink"
      />
      {children}
    </div>
  );
}

export function SyntheticBadge({ synthetic, dataSource }: { synthetic?: boolean; dataSource?: string }) {
  if (!synthetic && dataSource !== "synthetic") return null;
  return (
    <span className="ml-1 border border-hairline px-1 font-mono text-[10px] uppercase text-mute">synthetic</span>
  );
}
