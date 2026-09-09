import type { FormEvent } from "react";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { BrandLogo } from "../components/BrandLogo";
import { useAuth } from "../firebase/AuthProvider";
import { ROLE_HOME } from "../lib/roles";

export function LoginPage() {
  const { status, profile, login, configError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === "ready" && profile) {
    return <Navigate to={ROLE_HOME[profile.activeRole] ?? "/dispatcher"} replace />;
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
            <p className="font-sans text-[13px] text-mute">Real-time delivery operations</p>
          </div>
        </div>

        {status === "misconfigured" && (
          <p className="mt-6 border border-coral bg-paper px-3 py-2 font-sans text-[13px] text-coral">
            {configError}
          </p>
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
          {error && <p className="font-sans text-[13px] text-coral">{error}</p>}
          <button
            type="submit"
            disabled={busy || status === "misconfigured"}
            className="w-full bg-coral px-4 py-3 font-sans text-[14px] font-semibold text-ink disabled:opacity-40"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-4 font-sans text-[12px] text-mute">
          Demo accounts must exist in Firebase Auth. Roles are provisioned via backend script — passwords are never
          stored in the repo.
        </p>
      </div>
    </main>
  );
}
