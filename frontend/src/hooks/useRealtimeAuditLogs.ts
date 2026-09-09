import { useEffect, useState } from "react";
import type { SyncConnectionState } from "../lib/opsTypes";
import { getFirebase } from "../firebase/config";
import { subscribeToCollection } from "../services/firestore/subscribe";
import { classifyListenerError } from "./useRealtimeOps";

export type AuditLogRow = {
  id: string;
  organizationId?: string;
  eventType?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  actorUid?: string;
  actorId?: string;
  actorEmail?: string;
  metadata?: Record<string, unknown>;
  timestamp?: unknown;
  createdAt?: unknown;
};

/** Org-scoped auditLogs listener. */
export function useRealtimeAuditLogs(organizationId: string | null | undefined): {
  data: AuditLogRow[];
  loading: boolean;
  error: string | null;
  connection: SyncConnectionState;
} {
  const [data, setData] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(Boolean(organizationId));
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<SyncConnectionState>("loading");

  useEffect(() => {
    if (!organizationId) {
      setData([]);
      setLoading(false);
      setConnection("loading");
      return;
    }
    const fb = getFirebase();
    if (!fb.configured) {
      setError(fb.reason);
      setConnection("error");
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToCollection<Omit<AuditLogRow, "id">>("auditLogs", organizationId, (rows, err) => {
      if (err) {
        setError(err.message);
        setConnection(classifyListenerError(err));
        setLoading(false);
        return;
      }
      setError(null);
      setData((rows as AuditLogRow[]) ?? []);
      setConnection("live");
      setLoading(false);
    });
    return () => unsub();
  }, [organizationId]);

  return { data, loading, error, connection };
}
