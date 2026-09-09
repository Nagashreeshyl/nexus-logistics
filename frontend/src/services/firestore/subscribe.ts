import type { DocumentData, Query, Unsubscribe } from "firebase/firestore";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
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

/** Subscribe to a Firestore query. */
export function subscribeToQuery<T = DocumentData>(
  q: Query<DocumentData>,
  onNext: SnapshotHandler<Array<T & { id: string }>>,
): Unsubscribe {
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) }));
      onNext(rows);
    },
    (err) => onNext(null, err),
  );
}

/**
 * Organization-scoped collection subscription.
 * Always filters by organizationId — never global.
 */
export function subscribeToCollection<T = DocumentData>(
  collectionName: string,
  organizationId: string,
  onNext: SnapshotHandler<Array<T & { id: string }>>,
): Unsubscribe {
  const db = requireDb();
  const q = query(collection(db, collectionName), where("organizationId", "==", organizationId));
  return subscribeToQuery<T>(q, onNext);
}

export function userDocRef(uid: string) {
  return doc(requireDb(), "users", uid);
}

export function orgCollectionQuery(collectionName: string, organizationId: string) {
  return query(collection(requireDb(), collectionName), where("organizationId", "==", organizationId));
}
