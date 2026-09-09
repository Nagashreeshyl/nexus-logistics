import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, getDoc, onSnapshot, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getFirebase } from "./config";
import { NexusUser, Role, canAccessRole, normalizeRoles } from "../lib/roles";

type AuthStatus = "loading" | "ready" | "unauthenticated" | "misconfigured";

interface AuthContextValue {
  status: AuthStatus;
  firebaseUser: User | null;
  profile: NexusUser | null;
  configError: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setActiveRole: (role: Role) => Promise<void>;
  canAccess: (role: Role) => boolean;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function ensureProfile(uid: string, email: string): Promise<void> {
  const fb = getFirebase();
  if (!fb.configured) return;
  const ref = doc(fb.db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, {
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

function mapProfile(uid: string, data: Record<string, unknown>): NexusUser {
  const roles = normalizeRoles(data.roles);
  const activeRaw = data.activeRole as Role | undefined;
  const activeRole = roles.includes(activeRaw as Role) ? (activeRaw as Role) : roles[0] ?? "dispatcher";
  return {
    uid,
    email: String(data.email ?? ""),
    displayName: String(data.displayName ?? ""),
    roles,
    activeRole,
    driverId: (data.driverId as string | null) ?? null,
    organizationId: String(data.organizationId ?? "nexus-demo"),
    status: String(data.status ?? "active"),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const fb = getFirebase();
  const [status, setStatus] = useState<AuthStatus>(fb.configured ? "loading" : "misconfigured");
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<NexusUser | null>(null);
  const [configError] = useState<string | null>(fb.configured ? null : fb.reason);

  useEffect(() => {
    if (!fb.configured) return;
    const unsubAuth = onAuthStateChanged(fb.auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setProfile(null);
        setStatus("unauthenticated");
        return;
      }
      await ensureProfile(user.uid, user.email ?? "");
      setStatus("ready");
    });
    return () => unsubAuth();
  }, [fb]);

  useEffect(() => {
    if (!fb.configured || !firebaseUser) return;
    const ref = doc(fb.db, "users", firebaseUser.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setProfile(null);
          return;
        }
        setProfile(mapProfile(firebaseUser.uid, snap.data() as Record<string, unknown>));
      },
      () => setProfile(null),
    );
    return () => unsub();
  }, [fb, firebaseUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      if (!fb.configured) throw new Error(fb.reason);
      await signInWithEmailAndPassword(fb.auth, email, password);
    },
    [fb],
  );

  const logout = useCallback(async () => {
    if (!fb.configured) return;
    await signOut(fb.auth);
  }, [fb]);

  const setActiveRole = useCallback(
    async (role: Role) => {
      if (!fb.configured || !firebaseUser || !profile) return;
      if (!profile.roles.includes(role)) {
        throw new Error("Unauthorized role");
      }
      await updateDoc(doc(fb.db, "users", firebaseUser.uid), {
        activeRole: role,
        updatedAt: serverTimestamp(),
      });
    },
    [fb, firebaseUser, profile],
  );

  const getIdToken = useCallback(async () => {
    if (!firebaseUser) return null;
    return firebaseUser.getIdToken();
  }, [firebaseUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      firebaseUser,
      profile,
      configError,
      login,
      logout,
      setActiveRole,
      canAccess: (role) => canAccessRole(profile, role),
      getIdToken,
    }),
    [status, firebaseUser, profile, configError, login, logout, setActiveRole, getIdToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
