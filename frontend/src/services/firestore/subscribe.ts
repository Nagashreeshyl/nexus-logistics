import type { DocumentData, Query, Unsubscribe } from "firebase/firestore";
import { doc, onSnapshot } from "firebase/firestore";
import { getFirebase } from "../../firebase/config";

export type SnapshotHandler<T> = (data: T | null, error?: Error) => void;

function requireDb() {
  const fb = getFirebase();
  if (!fb.configured) {
    throw new Error(fb.reason);
  }
  return fb.db;
}

/** Subscribe to a single document. Returns unsubscribe. */
export function subscribeToDocument<T = DocumentData>(
  path: [string, string],
  onNext: SnapshotHandler<T & { id: string }>,
): Unsubscribe {
  const db = requireDb();
  const ref = doc(db, path[0], path[1]);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onNext(null);
        return;
      }
      onNext({ id: snap.id, ...(snap.data() as T) });
    },
    (err) => onNext(null, err),
  );
}

/** Subscribe to a query. */
export function subscribeToQuery<T = DocumentData>(
  query: Query<DocumentData>,
  onNext: SnapshotHandler<Array<T & { id: string }>>,
): Unsubscribe {
  return onSnapshot(
    query,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }));
      onNext(rows);
    },
    (err) => onNext(null, err),
  );
}

export function userDocRef(uid: string) {
  return doc(requireDb(), "users", uid);
}
