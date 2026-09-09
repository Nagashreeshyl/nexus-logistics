import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
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
import { useRealtimeUserProfile } from "../hooks/useRealtimeUserProfile";
import { NexusUser, Role, canAccessRole, hasPermission, Permission } from "../lib/roles";
import { ensureUserProfileShell, updateActiveRole } from "../services/firestore/users";

/** Auth machine states required by V2.3 */
export type AuthStatus =
  | "INITIALIZING"
  | "AUTHENTICATED"
  | "UNAUTHENTICATED"
  | "ERROR"
  | "MISCONFIGURED";

interface AuthContextValue {
  status: AuthStatus;
  firebaseUser: User | null;
  profile: NexusUser | null;
  profileLoading: boolean;
  configError: string | null;
  authError: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setActiveRole: (role: Role) => Promise<void>;
  /** Authorized roles[] — never activeRole. */
  canAccess: (role: Role) => boolean;
  can: (permission: Permission) => boolean;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const fb = getFirebase();
  const [status, setStatus] = useState<AuthStatus>(fb.configured ? "INITIALIZING" : "MISCONFIGURED");
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [configError] = useState<string | null>(fb.configured ? null : fb.reason);

  const {
    profile,
    loading: profileLoading,
    error: profileError,
  } = useRealtimeUserProfile(status === "AUTHENTICATED" ? firebaseUser?.uid : null);

  useEffect(() => {
    if (!fb.configured) return;
    const unsubAuth = onAuthStateChanged(
      fb.auth,
      async (user) => {
        setAuthError(null);
        setFirebaseUser(user);
        if (!user) {
          setStatus("UNAUTHENTICATED");
          return;
        }
        try {
          await ensureUserProfileShell(user.uid, user.email ?? "");
          setStatus("AUTHENTICATED");
        } catch (e) {
          setAuthError(e instanceof Error ? e.message : "Profile bootstrap failed");
          setStatus("ERROR");
        }
      },
      (err) => {
        setAuthError(err.message);
        setStatus("ERROR");
      },
    );
    return () => unsubAuth();
  }, [fb]);

  useEffect(() => {
    if (profileError && status === "AUTHENTICATED") {
      setAuthError(profileError);
    }
  }, [profileError, status]);

  const login = useCallback(
    async (email: string, password: string) => {
      if (!fb.configured) throw new Error(fb.reason);
      setAuthError(null);
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
      if (!firebaseUser || !profile) return;
      // Authorization gate: must be in roles[]; activeRole is UX only.
      await updateActiveRole(firebaseUser.uid, role, profile.roles);
    },
    [firebaseUser, profile],
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
      profileLoading,
      configError,
      authError,
      login,
      logout,
      setActiveRole,
      canAccess: (role) => canAccessRole(profile, role),
      can: (permission) => hasPermission(profile, permission),
      getIdToken,
    }),
    [
      status,
      firebaseUser,
      profile,
      profileLoading,
      configError,
      authError,
      login,
      logout,
      setActiveRole,
      getIdToken,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
