import { useEffect, useState } from "react";
import type { SyncConnectionState } from "../lib/opsTypes";
import { getFirebase } from "../firebase/config";
import { subscribeToCollection } from "../services/firestore/subscribe";
import { classifyListenerError } from "./useRealtimeOps";

export type OrgUserRow = {
  id: string;
  email?: string;
  displayName?: string;
  roles?: string[];
  activeRole?: string;
  status?: string;
  organizationId?: string;
  lastSeenAt?: unknown;
};

/** Org-scoped users listener (admin/dispatcher readable per rules). */
export function useRealtimeOrgUsers(organizationId: string | null | undefined): {
  data: OrgUserRow[];
  loading: boolean;
  error: string | null;
  connection: SyncConnectionState;
} {
  const [data, setData] = useState<OrgUserRow[]>([]);
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
    const unsub = subscribeToCollection<Omit<OrgUserRow, "id">>("users", organizationId, (rows, err) => {
      if (err) {
        setError(err.message);
        setConnection(classifyListenerError(err));
        setLoading(false);
        return;
      }
      setError(null);
      setData((rows as OrgUserRow[]) ?? []);
      setConnection("live");
      setLoading(false);
    });
    return () => unsub();
  }, [organizationId]);

  return { data, loading, error, connection };
}
