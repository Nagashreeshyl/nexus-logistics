export type Role = "admin" | "dispatcher" | "driver" | "analyst";

export const ALL_ROLES: Role[] = ["admin", "dispatcher", "driver", "analyst"];

export const ROLE_HOME: Record<Role, string> = {
  admin: "/admin",
  dispatcher: "/dispatcher",
  driver: "/driver",
  analyst: "/analyst",
};

export interface NexusUser {
  uid: string;
  email: string;
  displayName: string;
  roles: Role[];
  activeRole: Role;
  driverId: string | null;
  organizationId: string;
  status: string;
}

export function normalizeRoles(raw: unknown): Role[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((r): r is Role => ALL_ROLES.includes(r as Role));
}

export function canAccessRole(user: NexusUser | null, role: Role): boolean {
  return Boolean(user?.roles.includes(role));
}
