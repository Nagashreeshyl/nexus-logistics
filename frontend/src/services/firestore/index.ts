/**
 * Firestore data-access layer.
 * Keep queries / writes here — not in UI components.
 */
export {
  subscribeToCollection,
  subscribeToDocument,
  subscribeToQuery,
  orgCollectionQuery,
  userDocRef,
} from "./subscribe";
export {
  ensureUserProfileShell,
  getCurrentUserProfile,
  getOrganization,
  getUserRoles,
  updateActiveRole,
} from "./users";
export { getDrivers, getOrders, getVehicles } from "./entities";
export {
  createException,
  markNotificationRead,
  reassignDelivery,
  touchPresence,
  transitionDeliveryStatus,
} from "./operations";
export { seedRealtimeDemo } from "./seedRealtimeDemo";
export {
  createVehicle,
  updateVehicle,
  deactivateVehicle,
  createDriver,
  updateDriver,
  deactivateDriver,
  assignDriverVehicle,
  unassignDriverVehicle,
  createCustomer,
  updateCustomer,
  deactivateCustomer,
  createOrder,
  cancelOrder,
  assignOrderDelivery,
  generateSyntheticVehicle,
  generateSyntheticDriver,
  generateSyntheticCustomer,
  generateSyntheticOrder,
  generateOperationalScenario,
} from "./entityCrud";
