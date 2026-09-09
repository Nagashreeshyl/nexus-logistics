import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { BrandLogo } from "./BrandLogo";
import { useAuth } from "../firebase/AuthProvider";
import {
  ALL_ROLES,
  WORKSPACE_IDENTITY,
  getWorkspaceNav,
} from "../lib/roles";
import { LiveSyncBadge } from "./ops/OpsBadges";
import { useRealtimeNotifications } from "../hooks/useRealtimeNotifications";
import { markNotificationRead, touchPresence } from "../services/firestore/operations";
import { formatLastSeen } from "./ops/OpsBadges";
import { getFirebase } from "../firebase/config";
import { useWorkspaceNavigation } from "../hooks/useWorkspaceNavigation";

export function AppShell() {
  const { profile, logout, status, firebaseUser } = useAuth();
  const { notifications, unread, connection: notifConn } = useRealtimeNotifications(firebaseUser?.uid);
  const { switchWorkspace, switching, pathRole, authorizedRoles, activeRole } = useWorkspaceNavigation();
  const [openNotifs, setOpenNotifs] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const fbConfigured = getFirebase().configured;

  const workspaceRole = pathRole && authorizedRoles.includes(pathRole) ? pathRole : activeRole;
  const identity = workspaceRole ? WORKSPACE_IDENTITY[workspaceRole] : null;
  const navItems = workspaceRole ? getWorkspaceNav(workspaceRole) : [];

  useEffect(() => {
    if (!firebaseUser || !profile || status !== "AUTHENTICATED") return;
    void touchPresence({ uid: firebaseUser.uid, activeRole: profile.activeRole }).catch(() => undefined);
    const id = window.setInterval(() => {
      void touchPresence({ uid: firebaseUser.uid, activeRole: profile.activeRole }).catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(id);
  }, [firebaseUser, profile?.activeRole, profile?.uid, status]);

  useEffect(() => {
    setMobileNav(false);
  }, [pathRole, activeRole]);

  const workspaceList = (
    <div className="space-y-1">
      <p className="sys px-2">Workspace</p>
      {ALL_ROLES.filter((r) => authorizedRoles.includes(r)).map((role) => {
        const meta = WORKSPACE_IDENTITY[role];
        const active = workspaceRole === role;
        return (
          <button
            key={role}
            type="button"
            disabled={switching || status !== "AUTHENTICATED"}
            onClick={() => void switchWorkspace(role)}
            className={`flex w-full flex-col items-start gap-0.5 border px-3 py-2 text-left transition ${
              active
                ? "border-ink bg-ink text-snow"
                : "border-transparent text-ink hover:border-hairline hover:bg-paper"
            } disabled:opacity-50`}
          >
            <span className="font-sans text-[13px] font-semibold">
              {active ? "▣ " : "□ "}
              {meta.title}
            </span>
            <span className={`font-sans text-[11px] ${active ? "text-snow/70" : "text-mute"}`}>
              {meta.description}
            </span>
          </button>
        );
      })}
    </div>
  );

  const roleNav = (
    <div className="space-y-1">
      <p className="sys px-2">Navigation</p>
      {navItems.map((item) =>
        item.soon || !item.to ? (
          <span
            key={item.label}
            title="Coming in a later milestone"
            className="block cursor-not-allowed px-3 py-2 font-sans text-[13px] text-mute/70"
          >
            {item.label}
          </span>
        ) : (
          <NavLink
            key={`${item.label}-${item.to}`}
            to={item.to}
            end={item.to === `/${workspaceRole}`}
            className={({ isActive }) =>
              `block px-3 py-2 font-sans text-[13px] font-semibold ${
                isActive ? "bg-paper text-ink" : "text-mute hover:text-ink"
              }`
            }
          >
            {item.label}
          </NavLink>
        ),
      )}
      <NavLink
        to="/lab"
        className={({ isActive }) =>
          `block px-3 py-2 font-sans text-[13px] font-semibold ${
            isActive ? "bg-coral/30 text-ink" : "text-mute hover:text-ink"
          }`
        }
      >
        Optimizer Lab (V1)
      </NavLink>
    </div>
  );

  return (
    <div className="flex min-h-dvh bg-paper text-ink">
      {/* Desktop sidebar */}
      <aside className="hidden w-[260px] shrink-0 flex-col border-r border-hairline bg-snow md:flex">
        <div className="flex items-center gap-2 border-b border-hairline px-4 py-4">
          <BrandLogo className="h-8 w-8" />
          <div>
            <p className="font-sans text-[14px] font-semibold">Nexus Logistics</p>
            <p className="font-mono text-[10px] text-mute">Operations platform</p>
          </div>
        </div>
        <div className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {workspaceList}
          {roleNav}
        </div>
        <div className="border-t border-hairline px-4 py-3 font-mono text-[10px] text-mute">
          {profile?.email}
          <br />
          UID {firebaseUser?.uid?.slice(0, 8)}…
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-hairline bg-snow/95 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <button
              type="button"
              className="border border-hairline px-3 py-2 font-sans text-[13px] font-semibold md:hidden"
              onClick={() => setMobileNav((v) => !v)}
              aria-expanded={mobileNav}
            >
              Menu
            </button>
            <div className="mr-auto min-w-0">
              {identity ? (
                <>
                  <p className="sys text-coral">{identity.eyebrow}</p>
                  <p className="truncate font-sans text-[15px] font-semibold">{identity.description}</p>
                </>
              ) : (
                <p className="font-sans text-[14px] font-semibold">Nexus Logistics</p>
              )}
              <p className="truncate font-mono text-[11px] text-mute">
                {profile?.email ?? "…"}
                {profile?.lastSeenAt ? (
                  <span className="ml-2">· Last active {formatLastSeen(profile.lastSeenAt)}</span>
                ) : null}
              </p>
            </div>
            {fbConfigured && <LiveSyncBadge connection={notifConn === "loading" ? "loading" : notifConn} />}
            {switching && (
              <span className="font-sans text-[12px] font-semibold text-mute">Switching workspace…</span>
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
                  <p className="border-b border-hairline px-3 py-2 font-sans text-[12px] font-semibold">
                    In-app notifications
                  </p>
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
        </header>

        {mobileNav && (
          <div className="space-y-6 border-b border-hairline bg-snow px-3 py-4 md:hidden">
            {workspaceList}
            {roleNav}
          </div>
        )}

        <div className={`relative flex-1 ${switching ? "opacity-60" : ""}`}>
          {switching && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center pt-16">
              <p className="border border-hairline bg-snow px-4 py-2 font-sans text-[13px] font-semibold shadow-card">
                Loading workspace…
              </p>
            </div>
          )}
          <Outlet />
        </div>
      </div>
    </div>
  );
}
