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
  if (roles.includes("dispatcher")) return "dispatcher";
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
