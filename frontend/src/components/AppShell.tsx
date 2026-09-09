import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { BrandLogo } from "./BrandLogo";
import { useAuth } from "../firebase/AuthProvider";
import { ALL_ROLES, ROLE_HOME, ROLE_LABEL, Role } from "../lib/roles";

export function AppShell() {
  const { profile, logout, setActiveRole, status } = useAuth();
  const navigate = useNavigate();

  async function onRoleChange(role: Role) {
    await setActiveRole(role);
    navigate(ROLE_HOME[role]);
  }

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <header className="sticky top-0 z-40 border-b border-hairline bg-snow/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-3 px-4 py-3">
          <BrandLogo className="h-8 w-8" />
          <div className="mr-auto">
            <p className="font-sans text-[14px] font-semibold">Nexus Logistics</p>
            <p className="font-mono text-[11px] text-mute">{profile?.email ?? "…"}</p>
          </div>
          {profile && profile.roles.length > 0 && (
            <label className="flex items-center gap-2 font-sans text-[12px] font-semibold text-mute">
              Role
              <select
                aria-label="Active presentation role"
                className="min-h-10 border border-hairline bg-paper px-3 font-sans text-[13px] font-semibold text-ink"
                value={profile.activeRole}
                onChange={(e) => void onRoleChange(e.target.value as Role)}
                disabled={status !== "AUTHENTICATED"}
              >
                {ALL_ROLES.filter((r) => profile.roles.includes(r)).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            onClick={() => void logout()}
            className="border border-hairline px-3 py-2 font-sans text-[13px] font-semibold hover:border-ink"
          >
            Log out
          </button>
        </div>
        <nav className="mx-auto flex max-w-[1440px] gap-1 overflow-x-auto px-4 pb-2">
          {profile?.roles.map((r) => (
            <NavLink
              key={r}
              to={ROLE_HOME[r]}
              className={({ isActive }) =>
                `px-3 py-1.5 font-sans text-[12px] font-semibold ${
                  isActive ? "bg-ink text-snow" : "text-mute hover:text-ink"
                }`
              }
            >
              {ROLE_LABEL[r]}
            </NavLink>
          ))}
          <NavLink
            to="/lab"
            className={({ isActive }) =>
              `px-3 py-1.5 font-sans text-[12px] font-semibold ${
                isActive ? "bg-coral text-ink" : "text-mute hover:text-ink"
              }`
            }
          >
            Optimizer Lab (V1)
          </NavLink>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
