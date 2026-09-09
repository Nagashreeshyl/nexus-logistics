import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { BrandLogo } from "./BrandLogo";
import { useAuth } from "../firebase/AuthProvider";
import { ALL_ROLES, ROLE_HOME, ROLE_LABEL, Role } from "../lib/roles";
import { LiveSyncBadge } from "./ops/OpsBadges";
import { useRealtimeNotifications } from "../hooks/useRealtimeNotifications";
import { markNotificationRead, touchPresence } from "../services/firestore/operations";
import { formatLastSeen } from "./ops/OpsBadges";
import { getFirebase } from "../firebase/config";

export function AppShell() {
  const { profile, logout, setActiveRole, status, firebaseUser } = useAuth();
  const navigate = useNavigate();
  const { notifications, unread, connection: notifConn } = useRealtimeNotifications(firebaseUser?.uid);
  const [openNotifs, setOpenNotifs] = useState(false);
  const fbConfigured = getFirebase().configured;

  useEffect(() => {
    if (!firebaseUser || !profile || status !== "AUTHENTICATED") return;
    void touchPresence({ uid: firebaseUser.uid, activeRole: profile.activeRole }).catch(() => undefined);
    const id = window.setInterval(() => {
      void touchPresence({ uid: firebaseUser.uid, activeRole: profile.activeRole }).catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(id);
  }, [firebaseUser, profile, status]);

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
            <p className="font-mono text-[11px] text-mute">
              {profile?.email ?? "…"}
              {profile?.lastSeenAt ? (
                <span className="ml-2">· Last active {formatLastSeen(profile.lastSeenAt)}</span>
              ) : null}
            </p>
          </div>
          {fbConfigured && <LiveSyncBadge connection={notifConn === "loading" ? "loading" : notifConn} />}
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
          <div className="relative">
            <button
              type="button"
              className="border border-hairline px-3 py-2 font-sans text-[13px] font-semibold"
              onClick={() => setOpenNotifs((v) => !v)}
            >
              Alerts{unread ? ` (${unread})` : ""}
            </button>
            {openNotifs && (
              <div className="absolute right-0 z-50 mt-1 w-80 border border-ink bg-snow shadow-card">
                <p className="border-b border-hairline px-3 py-2 font-sans text-[12px] font-semibold">In-app notifications</p>
                <ul className="max-h-72 overflow-auto">
                  {notifications.length === 0 && (
                    <li className="px-3 py-4 font-sans text-[12px] text-mute">No notifications yet.</li>
                  )}
                  {notifications.slice(0, 20).map((n) => (
                    <li key={n.id} className="border-b border-hairline/70 px-3 py-2">
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() => void markNotificationRead(n.id)}
                      >
                        <p className="font-sans text-[12px] font-semibold">{n.title}</p>
                        <p className="font-mono text-[11px] text-mute">{n.body}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
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
