/**
 * Pure RBAC helpers — run with: npx --yes tsx src/lib/roles.selftest.ts
 * (no Firebase required)
 */
import {
  canAccessRole,
  hasPermission,
  mapUserDoc,
  normalizeRoles,
  pickActiveRole,
} from "./roles";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const multi = mapUserDoc("u1", {
  email: "a@b.com",
  roles: ["admin", "dispatcher", "driver", "analyst"],
  activeRole: "driver",
  organizationId: "nexus-demo",
});

assert(canAccessRole(multi, "admin"), "multi-role can access admin");
assert(multi.activeRole === "driver", "activeRole remains driver");
assert(hasPermission(multi, "manage_users"), "admin permission via roles[]");
assert(pickActiveRole(["driver"], "admin") === "driver", "cannot pick unauthorized preferred");
assert(normalizeRoles(["admin", "nope"]).length === 1, "normalize filters");

const driverOnly = mapUserDoc("u2", { roles: ["driver"], activeRole: "admin" });
assert(!canAccessRole(driverOnly, "admin"), "spoofed activeRole cannot grant admin");
assert(driverOnly.activeRole === "driver", "pickActiveRole corrects spoof");

const analyst = mapUserDoc("u3", { roles: ["analyst"], activeRole: "analyst" });
assert(!hasPermission(analyst, "manage_orders"), "analyst cannot write ops");
assert(hasPermission(analyst, "view_analytics"), "analyst can view analytics");

const switched = { ...multi, activeRole: "admin" as const };
assert(switched.roles.length === 4, "role switch does not shrink roles[]");
assert(canAccessRole(switched, "driver"), "authorized roles unchanged after UX switch");

console.log("roles.selftest OK");
