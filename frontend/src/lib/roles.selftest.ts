/**
 * Pure RBAC + workspace route helpers — npm run test:roles
 */
import {
  canAccessRole,
  getRoleHomeRoute,
  hasPermission,
  mapUserDoc,
  normalizeRoles,
  pickActiveRole,
  roleFromPathname,
} from "./roles";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(getRoleHomeRoute("admin") === "/admin", "admin route");
assert(getRoleHomeRoute("dispatcher") === "/dispatcher", "dispatcher route");
assert(getRoleHomeRoute("driver") === "/driver", "driver route");
assert(getRoleHomeRoute("analyst") === "/analyst", "analyst route");
assert(roleFromPathname("/driver/foo") === "driver", "path role");
assert(roleFromPathname("/login") === null, "non-workspace path");

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
assert(pickActiveRole(["dispatcher", "driver"], null) === "dispatcher", "default order dispatcher");
assert(pickActiveRole(["driver", "admin"], null) === "admin", "default order prefers admin");
assert(normalizeRoles(["admin", "nope"]).length === 1, "normalize filters");

const driverOnly = mapUserDoc("u2", { roles: ["driver"], activeRole: "admin" });
assert(!canAccessRole(driverOnly, "admin"), "spoofed activeRole cannot grant admin");
assert(driverOnly.activeRole === "driver", "pickActiveRole corrects spoof");
assert(getRoleHomeRoute(driverOnly.activeRole) === "/driver", "single-role home");

const analyst = mapUserDoc("u3", { roles: ["analyst"], activeRole: "analyst" });
assert(!hasPermission(analyst, "manage_orders"), "analyst cannot write ops");
assert(hasPermission(analyst, "view_analytics"), "analyst can view analytics");

const switched = { ...multi, activeRole: "admin" as const };
assert(switched.roles.length === 4, "role switch does not shrink roles[]");
assert(canAccessRole(switched, "driver"), "authorized roles unchanged after UX switch");
assert(getRoleHomeRoute(switched.activeRole) === "/admin", "switched workspace url");

console.log("roles.selftest OK");
