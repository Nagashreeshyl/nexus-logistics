/**
 * Firestore data-access layer.
 * Keep queries here — not in UI components.
 */
export { subscribeToDocument, subscribeToQuery, userDocRef } from "./subscribe";
export {
  ensureUserProfileShell,
  getCurrentUserProfile,
  getOrganization,
  getUserRoles,
  updateActiveRole,
} from "./users";
export { getDrivers, getOrders, getVehicles } from "./entities";
