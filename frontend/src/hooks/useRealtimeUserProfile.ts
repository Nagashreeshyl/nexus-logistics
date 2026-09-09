import { useEffect, useState } from "react";
import { mapUserDoc, NexusUser } from "../lib/roles";
import { subscribeToDocument } from "../services/firestore/subscribe";
import { getFirebase } from "../firebase/config";

/**
 * Realtime user profile. Demonstrates the subscription pattern later milestones reuse.
 * Authorization still uses roles[] from this profile — never URL/localStorage.
 */
export function useRealtimeUserProfile(uid: string | null | undefined): {
  profile: NexusUser | null;
  loading: boolean;
  error: string | null;
} {
  const [profile, setProfile] = useState<NexusUser | null>(null);
  const [loading, setLoading] = useState(Boolean(uid));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setLoading(false);
      return;
    }
    const fb = getFirebase();
    if (!fb.configured) {
      setError(fb.reason);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToDocument<Record<string, unknown>>(["users", uid], (data, err) => {
      if (err) {
        setError(err.message);
        setProfile(null);
        setLoading(false);
        return;
      }
      setError(null);
      setProfile(data ? mapUserDoc(uid, data) : null);
      setLoading(false);
    });
    return () => unsub();
  }, [uid]);

  return { profile, loading, error };
}
