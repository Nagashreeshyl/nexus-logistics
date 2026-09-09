import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../firebase/AuthProvider";
import type { Role } from "../lib/roles";

export function RequireAuth({ children }: { children?: ReactNode }) {
  const { status, configError, authError } = useAuth();
  const location = useLocation();

  if (status === "INITIALIZING") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper font-sans text-mute">
        Checking session…
      </div>
    );
  }

  if (status === "MISCONFIGURED") {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 font-sans text-ink">
        <h1 className="text-[22px] font-semibold">Firebase not configured</h1>
        <p className="mt-3 text-mute">{configError}</p>
        <p className="mt-3 text-[14px] text-mute">
          See <code className="font-mono">docs/FIREBASE_SETUP.md</code>. Optimizer Lab:{" "}
          <a className="underline" href="/lab">
            /lab
          </a>
        </p>
      </div>
    );
  }

  if (status === "ERROR") {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 font-sans text-ink">
        <h1 className="text-[22px] font-semibold">Authentication error</h1>
        <p className="mt-3 text-coral">{authError ?? "Unknown error"}</p>
        <a className="mt-4 inline-block underline" href="/login">
          Back to login
        </a>
      </div>
    );
  }

  if (status === "UNAUTHENTICATED") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children ? <>{children}</> : <Outlet />;
}

export function RequireRole({ role }: { role: Role }) {
  const { profile, canAccess, profileLoading, status } = useAuth();

  if (status === "AUTHENTICATED" && profileLoading && !profile) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center font-sans text-mute">Loading profile…</div>
    );
  }

  if (!profile) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccess(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
