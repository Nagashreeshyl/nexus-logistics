import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../firebase/AuthProvider";
import {
  Role,
  canAccessRole,
  getRoleHomeRoute,
  pickActiveRole,
  roleFromPathname,
} from "../lib/roles";

/**
 * Keeps URL ↔ activeRole in sync without logout or navigation loops.
 * Authorization still uses roles[] only.
 */
export function useWorkspaceNavigation() {
  const { profile, setActiveRole, canAccess, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [switching, setSwitching] = useState(false);
  const switchingTo = useRef<Role | null>(null);

  const pathRole = roleFromPathname(location.pathname);

  const switchWorkspace = useCallback(
    async (role: Role) => {
      if (!profile) return;
      if (!canAccess(role)) return;
      const target = getRoleHomeRoute(role);
      if (location.pathname === target || location.pathname.startsWith(`${target}/`)) {
        if (profile.activeRole !== role) {
          await setActiveRole(role);
        }
        return;
      }
      setSwitching(true);
      switchingTo.current = role;
      try {
        await setActiveRole(role);
        navigate(target);
      } finally {
        setSwitching(false);
        switchingTo.current = null;
      }
    },
    [profile, canAccess, location.pathname, setActiveRole, navigate],
  );

  // Direct URL visit: if authorized for path role, sync activeRole (no loop).
  useEffect(() => {
    if (status !== "AUTHENTICATED" || !profile || !pathRole) return;
    if (switchingTo.current) return;
    if (!canAccessRole(profile, pathRole)) return;
    if (profile.activeRole === pathRole) return;
    void setActiveRole(pathRole);
  }, [status, profile, pathRole, setActiveRole]);

  // If activeRole changes remotely and URL is a workspace root that doesn't match, navigate once.
  useEffect(() => {
    if (status !== "AUTHENTICATED" || !profile || switching) return;
    if (switchingTo.current) return;
    if (!pathRole) return; // e.g. /unauthorized — leave alone
    if (!canAccessRole(profile, pathRole)) return;
    // Already on a path for this workspace family — don't bounce to home on nested routes.
    if (pathRole === profile.activeRole) return;
    // Path role authorized but differs from activeRole: prefer URL (handled above via setActiveRole).
  }, [status, profile, pathRole, switching]);

  const fallbackHome = profile
    ? getRoleHomeRoute(pickActiveRole(profile.roles, profile.activeRole))
    : "/login";

  return {
    switchWorkspace,
    switching,
    pathRole,
    fallbackHome,
    authorizedRoles: profile?.roles ?? [],
    activeRole: profile?.activeRole ?? null,
  };
}
