import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { getFirebase } from "../../firebase/config";
import { NexusUser, Role, mapUserDoc } from "../../lib/roles";

function dbOrThrow() {
  const fb = getFirebase();
  if (!fb.configured) throw new Error(fb.reason);
  return fb.db;
}

export async function getCurrentUserProfile(uid: string): Promise<NexusUser | null> {
  const snap = await getDoc(doc(dbOrThrow(), "users", uid));
  if (!snap.exists()) return null;
  return mapUserDoc(uid, snap.data() as Record<string, unknown>);
}

export async function getUserRoles(uid: string): Promise<Role[]> {
  const profile = await getCurrentUserProfile(uid);
  return profile?.roles ?? [];
}

export async function ensureUserProfileShell(uid: string, email: string): Promise<void> {
  const ref = doc(dbOrThrow(), "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  // roles stay empty until provisioned — clients cannot self-grant roles (Security Rules).
  await setDoc(ref, {
    uid,
    email,
    displayName: email.split("@")[0],
    roles: [],
    activeRole: "dispatcher",
    driverId: null,
    organizationId: "nexus-demo",
    status: "pending_roles",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** UX-only: updates activeRole. Does not modify roles[]. */
export async function updateActiveRole(uid: string, role: Role, authorized: Role[]): Promise<void> {
  if (!authorized.includes(role)) {
    throw new Error("Cannot activate a role you are not authorized for");
  }
  await updateDoc(doc(dbOrThrow(), "users", uid), {
    activeRole: role,
    updatedAt: serverTimestamp(),
  });
}

export async function getOrganization(orgId: string): Promise<Record<string, unknown> | null> {
  const snap = await getDoc(doc(dbOrThrow(), "organizations", orgId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}
