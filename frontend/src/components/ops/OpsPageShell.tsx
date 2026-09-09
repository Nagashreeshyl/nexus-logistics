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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-sans text-[24px] font-semibold text-ink">{title}</h1>
          {subtitle ? <p className="mt-1 max-w-[70ch] font-sans text-[14px] text-mute">{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LiveSyncBadge connection={connection} />
          {actions}
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
        <div key={label} className="border border-hairline bg-snow px-3 py-3">
          <p className="sys">{label}</p>
          <p className="mt-1 font-mono text-[20px] font-semibold tabular text-ink">{value}</p>
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
        className="min-w-[220px] flex-1 border border-hairline bg-paper px-3 py-2 font-mono text-[13px] outline-none focus:border-ink"
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
