export type Role = "admin" | "dispatcher" | "driver" | "analyst";

export const ALL_ROLES: readonly Role[] = ["admin", "dispatcher", "driver", "analyst"] as const;

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  dispatcher: "Dispatcher",
  driver: "Driver",
  analyst: "Analyst",
};

export const ROLE_HOME: Record<Role, string> = {
  admin: "/admin",
  dispatcher: "/dispatcher",
  driver: "/driver",
  analyst: "/analyst",
};

/** Centralized role → workspace route mapping. */
export function getRoleHomeRoute(role: Role): string {
  return ROLE_HOME[role];
}

/** Preferred default when activeRole is missing/invalid. */
export const ROLE_DEFAULT_ORDER: readonly Role[] = [
  "admin",
  "dispatcher",
  "driver",
  "analyst",
] as const;

export const WORKSPACE_IDENTITY: Record<
  Role,
  { title: string; eyebrow: string; description: string }
> = {
  admin: {
    title: "Admin",
    eyebrow: "ADMIN",
    description: "Administration & System Control",
  },
  dispatcher: {
    title: "Dispatcher",
    eyebrow: "DISPATCHER",
    description: "Real-Time Operations",
  },
  driver: {
    title: "Driver",
    eyebrow: "DRIVER",
    description: "My Route & Deliveries",
  },
  analyst: {
    title: "Analyst",
    eyebrow: "ANALYST",
    description: "Insights & Performance",
  },
};

export type WorkspaceNavItem = {
  label: string;
  to?: string;
  /** Shown but not navigable until a later milestone */
  soon?: boolean;
};

/** Role-specific navigation (workspace chrome). Authorization still uses roles[]. */
const WORKSPACE_NAV_BASE: Record<Role, readonly WorkspaceNavItem[]> = {
  admin: [
    { label: "Dashboard", to: "/admin" },
    { label: "Fleet", to: "/admin/fleet" },
    { label: "Drivers", to: "/admin/drivers" },
    { label: "Customers", to: "/admin/customers" },
    { label: "Orders", to: "/admin/orders" },
    { label: "Users", soon: true },
    { label: "Organizations", soon: true },
    { label: "Audit", soon: true },
  ],
  dispatcher: [
    { label: "Operations", to: "/dispatcher" },
    { label: "Orders", to: "/dispatcher/orders" },
    { label: "Deliveries", to: "/dispatcher/deliveries" },
    { label: "Fleet", to: "/dispatcher/fleet" },
    { label: "Drivers", to: "/dispatcher/drivers" },
    { label: "Customers", to: "/dispatcher/customers" },
    { label: "Exceptions", to: "/dispatcher/exceptions" },
    { label: "Optimize", to: "/dispatcher/optimize" },
    { label: "Scenarios", to: "/dispatcher/scenarios" },
  ],
  driver: [
    { label: "My Route", to: "/driver" },
    { label: "My Deliveries", to: "/driver/route" },
    { label: "Vehicle", to: "/driver/vehicle" },
  ],
  analyst: [
    { label: "Overview", to: "/analyst" },
    { label: "Orders", to: "/analyst/orders" },
    { label: "Deliveries", to: "/analyst/deliveries" },
    { label: "Fleet", to: "/analyst/fleet" },
    { label: "Drivers", to: "/analyst/drivers" },
    { label: "Performance", to: "/analyst/performance" },
    { label: "Exceptions", to: "/analyst/exceptions" },
  ],
};

export function getWorkspaceNav(role: Role): WorkspaceNavItem[] {
  const items = [...WORKSPACE_NAV_BASE[role]];
  if (role === "dispatcher" && typeof import.meta !== "undefined" && import.meta.env?.DEV) {
    items.push({ label: "Realtime Lab", to: "/dispatcher/realtime-lab" });
  }
  return items;
}

/** Resolve workspace role from a pathname like /dispatcher/orders → dispatcher */
export function roleFromPathname(pathname: string): Role | null {
  const seg = pathname.split("/").filter(Boolean)[0];
  if (seg && (ALL_ROLES as readonly string[]).includes(seg)) return seg as Role;
  return null;
}

/** Capability keys — UI may hide controls; server/rules enforce for real. */
export type Permission =
  | "manage_users"
  | "manage_fleet"
  | "manage_orders"
  | "run_optimization"
  | "manage_exceptions"
  | "execute_deliveries"
  | "view_analytics"
  | "view_audit";

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: [
    "manage_users",
    "manage_fleet",
    "manage_orders",
    "run_optimization",
    "manage_exceptions",
    "execute_deliveries",
    "view_analytics",
    "view_audit",
  ],
  dispatcher: [
    "manage_fleet",
    "manage_orders",
    "run_optimization",
    "manage_exceptions",
    "view_analytics",
  ],
  driver: ["execute_deliveries"],
  analyst: ["view_analytics"],
};

export interface NexusUser {
  uid: string;
  email: string;
  displayName: string;
  roles: Role[];
  /** Presentation context only — never used for authorization. */
  activeRole: Role;
  driverId: string | null;
  organizationId: string;
  status: string;
  /** Presence heartbeat — label as Last active, not Online. */
  lastSeenAt?: unknown;
  lastActiveRole?: string | null;
}

export function normalizeRoles(raw: unknown): Role[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((r): r is Role => (ALL_ROLES as readonly string[]).includes(String(r)));
}

/** Authorization uses roles[], never activeRole. */
export function canAccessRole(user: NexusUser | null | undefined, role: Role): boolean {
  return Boolean(user?.roles.includes(role));
}

export function hasPermission(user: NexusUser | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  return user.roles.some((r) => ROLE_PERMISSIONS[r].includes(permission));
}

export function pickActiveRole(roles: Role[], preferred?: string | null): Role {
  if (preferred && roles.includes(preferred as Role)) return preferred as Role;
  for (const r of ROLE_DEFAULT_ORDER) {
    if (roles.includes(r)) return r;
  }
  return roles[0] ?? "dispatcher";
}

export function mapUserDoc(uid: string, data: Record<string, unknown>): NexusUser {
  const roles = normalizeRoles(data.roles);
  return {
    uid,
    email: String(data.email ?? ""),
    displayName: String(data.displayName ?? ""),
    roles,
    activeRole: pickActiveRole(roles, data.activeRole as string | undefined),
    driverId: (data.driverId as string | null) ?? null,
    organizationId: String(data.organizationId ?? "nexus-demo"),
    status: String(data.status ?? "active"),
    lastSeenAt: data.lastSeenAt,
    lastActiveRole: (data.lastActiveRole as string | null) ?? null,
  };
}
