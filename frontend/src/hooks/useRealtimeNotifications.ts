import { useEffect, useMemo, useState } from "react";
import { collection, query, where } from "firebase/firestore";
import type { OpsNotification, SyncConnectionState } from "../lib/opsTypes";
import { getFirebase } from "../firebase/config";
import { subscribeToQuery } from "../services/firestore/subscribe";
import { classifyListenerError } from "./useRealtimeOps";

export function useRealtimeNotifications(uid: string | null | undefined): {
  notifications: OpsNotification[];
  unread: number;
  loading: boolean;
  error: string | null;
  connection: SyncConnectionState;
} {
  const [notifications, setNotifications] = useState<OpsNotification[]>([]);
  const [loading, setLoading] = useState(Boolean(uid));
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<SyncConnectionState>("loading");

  useEffect(() => {
    if (!uid) {
      setNotifications([]);
      setLoading(false);
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
    const q = query(collection(fb.db, "notifications"), where("userId", "==", uid));
    const unsub = subscribeToQuery<Omit<OpsNotification, "id">>(q, (rows, err) => {
      if (err) {
        setError(err.message);
        setConnection(classifyListenerError(err));
        setLoading(false);
        return;
      }
      const list = (rows as OpsNotification[]) ?? [];
      list.sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
      setNotifications(list);
      setError(null);
      setConnection("live");
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  const unread = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);
  return { notifications, unread, loading, error, connection };
}
