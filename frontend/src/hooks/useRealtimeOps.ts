import { useEffect, useState } from "react";
import type { OpsCustomer, OpsDelivery, OpsDriver, OpsException, OpsOrder, OpsVehicle, SyncConnectionState } from "../lib/opsTypes";
import { getFirebase } from "../firebase/config";
import { subscribeToCollection, subscribeToDocument } from "../services/firestore/subscribe";

export function classifyListenerError(err?: Error | null): SyncConnectionState {
  if (!err) return "live";
  const msg = err.message.toLowerCase();
  if (msg.includes("permission") || msg.includes("insufficient")) return "permission_denied";
  if (msg.includes("network") || msg.includes("unavailable") || msg.includes("offline")) return "offline";
  return "error";
}

/** Generic org-scoped collection listener. */
export function useRealtimeOrgCollection<T extends { id: string }>(
  collectionName: string,
  organizationId: string | null | undefined,
): {
  data: T[];
  loading: boolean;
  error: string | null;
  connection: SyncConnectionState;
} {
  const [data, setData] = useState<T[]>([]);
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
    setConnection("loading");

    const unsub = subscribeToCollection<Omit<T, "id">>(collectionName, organizationId, (rows, err) => {
      if (err) {
        setError(err.message);
        setConnection(classifyListenerError(err));
        setLoading(false);
        return;
      }
      setError(null);
      setData((rows as T[]) ?? []);
      setConnection("live");
      setLoading(false);
    });

    return () => unsub();
  }, [collectionName, organizationId]);

  return { data, loading, error, connection };
}

export function useRealtimeOrganization(organizationId: string | null | undefined) {
  const [org, setOrg] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(Boolean(organizationId));
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<SyncConnectionState>("loading");

  useEffect(() => {
    if (!organizationId) {
      setOrg(null);
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
    const unsub = subscribeToDocument(["organizations", organizationId], (data, err) => {
      if (err) {
        setError(err.message);
        setConnection(classifyListenerError(err));
        setOrg(null);
        setLoading(false);
        return;
      }
      setError(null);
      setOrg(data);
      setConnection("live");
      setLoading(false);
    });
    return () => unsub();
  }, [organizationId]);

  return { organization: org, loading, error, connection };
}

export function useRealtimeDeliveries(organizationId: string | null | undefined) {
  return useRealtimeOrgCollection<OpsDelivery>("deliveries", organizationId);
}

export function useRealtimeDrivers(organizationId: string | null | undefined) {
  return useRealtimeOrgCollection<OpsDriver>("drivers", organizationId);
}

export function useRealtimeVehicles(organizationId: string | null | undefined) {
  return useRealtimeOrgCollection<OpsVehicle>("vehicles", organizationId);
}

export function useRealtimeOrders(organizationId: string | null | undefined) {
  return useRealtimeOrgCollection<OpsOrder>("orders", organizationId);
}

export function useRealtimeRoutes(organizationId: string | null | undefined) {
  return useRealtimeOrgCollection("routes", organizationId);
}

export function useRealtimeExceptions(organizationId: string | null | undefined) {
  return useRealtimeOrgCollection<OpsException>("exceptions", organizationId);
}

export function useRealtimeCustomers(organizationId: string | null | undefined) {
  return useRealtimeOrgCollection<OpsCustomer>("customers", organizationId);
}

export function useRealtimeOptimizationRuns(organizationId: string | null | undefined) {
  return useRealtimeOrgCollection("optimizationRuns", organizationId);
}

/** Merge connection states — live only if all live. */
export function mergeConnection(...states: SyncConnectionState[]): SyncConnectionState {
  if (states.some((s) => s === "permission_denied")) return "permission_denied";
  if (states.some((s) => s === "error")) return "error";
  if (states.some((s) => s === "offline")) return "offline";
  if (states.some((s) => s === "loading")) return "loading";
  return "live";
}
