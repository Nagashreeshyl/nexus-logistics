import type { FormEvent } from "react";
import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { BrandLogo } from "../components/BrandLogo";
import { useAuth } from "../firebase/AuthProvider";
import { getRoleHomeRoute, pickActiveRole } from "../lib/roles";

export function LoginPage() {
  const { status, profile, profileLoading, login, configError, authError } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === "INITIALIZING" || (status === "AUTHENTICATED" && profileLoading && !profile)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-paper font-sans text-mute">Checking session…</div>
    );
  }

  if (status === "AUTHENTICATED" && profile) {
    if (profile.roles.length === 0) {
      return <Navigate to="/unauthorized" replace />;
    }
    const from = (location.state as { from?: string } | null)?.from;
    const home = getRoleHomeRoute(pickActiveRole(profile.roles, profile.activeRole));
    const dest = from && !from.startsWith("/login") ? from : home;
    return <Navigate to={dest} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper px-4">
      <div className="w-full max-w-md border border-ink bg-snow p-8 shadow-card">
        <div className="flex items-center gap-3">
          <BrandLogo className="h-10 w-10" />
          <div>
            <p className="font-sans text-[18px] font-semibold text-ink">Nexus Logistics</p>
            <p className="font-sans text-[13px] text-mute">Sign in to operations</p>
          </div>
        </div>

        {status === "MISCONFIGURED" && (
          <p className="mt-6 border border-coral bg-paper px-3 py-2 font-sans text-[13px] text-coral">{configError}</p>
        )}

        <form className="mt-8 space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <label className="block font-sans text-[13px] font-semibold text-ink">
            Email
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full border border-hairline bg-paper px-3 py-2 font-mono text-[14px] text-ink outline-none focus:border-ink"
            />
          </label>
          <label className="block font-sans text-[13px] font-semibold text-ink">
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full border border-hairline bg-paper px-3 py-2 font-mono text-[14px] text-ink outline-none focus:border-ink"
            />
          </label>
          {(error || authError) && (
            <p className="font-sans text-[13px] text-coral">{error || authError}</p>
          )}
          <button
            type="submit"
            disabled={busy || status === "MISCONFIGURED"}
            className="w-full bg-coral px-4 py-3 font-sans text-[14px] font-semibold text-ink disabled:opacity-40"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-4 font-sans text-[12px] text-mute">
          No demo password bypass. Create Auth users in Firebase Console, then run{" "}
          <code className="font-mono">provision_demo_users.py</code>.
        </p>
      </div>
    </main>
  );
}
