import type { DeliveryStatus } from "../../lib/deliveryStatus";
import { DELIVERY_STATUS_LABEL } from "../../lib/deliveryStatus";
import type { SyncConnectionState } from "../../lib/opsTypes";

const STATUS_CLASS: Record<DeliveryStatus, string> = {
  CREATED: "bg-[#eceae4] text-ink",
  ASSIGNED: "bg-ice/40 text-ink",
  EN_ROUTE: "bg-coral/25 text-ink",
  ARRIVED: "bg-coral/40 text-ink",
  DELIVERED: "bg-ink text-snow",
  FAILED: "bg-coral text-ink",
};

export function StatusBadge({ status }: { status: string }) {
  const label = DELIVERY_STATUS_LABEL[status as DeliveryStatus] ?? status;
  const cls = STATUS_CLASS[status as DeliveryStatus] ?? "bg-[#eceae4] text-ink";
  return (
    <span className={`inline-block px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

export function LiveSyncBadge({ connection }: { connection: SyncConnectionState }) {
  if (connection === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 font-sans text-[12px] font-semibold text-ink" title="Firestore listeners connected">
        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-600" aria-hidden />
        Live
      </span>
    );
  }
  if (connection === "loading") {
    return <span className="font-sans text-[12px] font-semibold text-mute">Syncing…</span>;
  }
  if (connection === "offline") {
    return (
      <span className="font-sans text-[12px] font-semibold text-coral" title="Network issue — showing last synchronized data if available">
        Connection issue
      </span>
    );
  }
  if (connection === "permission_denied") {
    return <span className="font-sans text-[12px] font-semibold text-coral">Permission denied</span>;
  }
  return <span className="font-sans text-[12px] font-semibold text-coral">Unable to synchronize</span>;
}

export function RiskPill({ level }: { level?: string | null }) {
  if (!level) return <span className="text-mute">—</span>;
  const tone =
    level === "critical" || level === "high"
      ? "text-coral"
      : level === "medium"
        ? "text-ink"
        : "text-mute";
  return <span className={`font-mono text-[11px] font-semibold uppercase ${tone}`}>{level}</span>;
}

export function formatLastSeen(value: unknown): string {
  if (!value) return "—";
  try {
    // Firestore Timestamp
    const anyVal = value as { toDate?: () => Date; seconds?: number };
    const d = anyVal.toDate?.() ?? (typeof anyVal.seconds === "number" ? new Date(anyVal.seconds * 1000) : new Date(String(value)));
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  } catch {
    return "—";
  }
}
