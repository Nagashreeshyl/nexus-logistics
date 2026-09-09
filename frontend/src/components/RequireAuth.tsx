import type { ReactNode } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../firebase/AuthProvider";
import type { Role } from "../lib/roles";

export function RequireAuth({ children }: { children?: ReactNode }) {
  const { status, configError } = useAuth();
  if (status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper font-sans text-mute">
        Checking session…
      </div>
    );
  }
  if (status === "misconfigured") {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 font-sans text-ink">
        <h1 className="text-[22px] font-semibold">Firebase not configured</h1>
        <p className="mt-3 text-mute">{configError}</p>
        <p className="mt-3 text-[14px] text-mute">
          Follow <code className="font-mono">docs/FIREBASE_SETUP.md</code>. V1 Optimizer Lab remains available at{" "}
          <a className="underline" href="/lab">
            /lab
          </a>{" "}
          without Auth when you open it directly in this build once routing is enabled.
        </p>
      </div>
    );
  }
  if (status === "unauthenticated") return <Navigate to="/login" replace />;
  return children ? <>{children}</> : <Outlet />;
}

export function RequireRole({ role }: { role: Role }) {
  const { profile, canAccess } = useAuth();
  if (!profile) return <Navigate to="/login" replace />;
  if (!canAccess(role)) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 font-sans">
        <h1 className="text-[20px] font-semibold text-ink">Unauthorized</h1>
        <p className="mt-2 text-mute">
          Your account does not include the <strong>{role}</strong> role. Use the role switcher for roles you are
          assigned, or ask an admin to provision roles.
        </p>
      </div>
    );
  }
  return <Outlet />;
}
