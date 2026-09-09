import { Link } from "react-router-dom";
import { useAuth } from "../firebase/AuthProvider";
import { ROLE_HOME, ROLE_LABEL } from "../lib/roles";

export function UnauthorizedPage() {
  const { profile, logout } = useAuth();
  const hasRoles = Boolean(profile?.roles.length);
  const home = hasRoles && profile ? ROLE_HOME[profile.activeRole] : "/login";

  return (
    <main className="mx-auto max-w-lg px-6 py-20 font-sans text-ink">
      <h1 className="text-[24px] font-semibold">Unauthorized</h1>
      <p className="mt-3 text-[15px] text-mute">
        You are signed in, but your authorized <code className="font-mono">roles[]</code> do not include this area.
        Changing the URL cannot grant access. Use the role switcher for roles you already have.
      </p>
      {profile && (
        <ul className="mt-4 font-mono text-[12px] text-mute">
          <li>email: {profile.email}</li>
          <li>authorized: {profile.roles.map((r) => ROLE_LABEL[r]).join(", ") || "(none — run provisioning)"}</li>
          <li>activeRole (UX only): {ROLE_LABEL[profile.activeRole]}</li>
        </ul>
      )}
      {!hasRoles && (
        <p className="mt-4 font-sans text-[13px] text-mute">
          Profile has no roles yet. After Firebase Auth users exist, run{" "}
          <code className="font-mono">backend/scripts/provision_demo_users.py</code>.
        </p>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        {hasRoles ? (
          <Link to={home} className="inline-block bg-coral px-4 py-2 text-[13px] font-semibold text-ink">
            Go to your dashboard
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => void logout()}
            className="bg-coral px-4 py-2 text-[13px] font-semibold text-ink"
          >
            Log out
          </button>
        )}
      </div>
    </main>
  );
}
