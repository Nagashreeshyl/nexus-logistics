/** Centralized operational enums — no free-form status strings in UI. */

export const VEHICLE_TYPES = ["VAN", "TRUCK", "MINI_TRUCK", "BIKE", "EV"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const VEHICLE_STATUSES = [
  "AVAILABLE",
  "ASSIGNED",
  "EN_ROUTE",
  "MAINTENANCE",
  "BREAKDOWN",
  "INACTIVE",
] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export const DRIVER_STATUSES = [
  "AVAILABLE",
  "ASSIGNED",
  "ON_ROUTE",
  "OFF_DUTY",
  "UNAVAILABLE",
] as const;
export type DriverStatus = (typeof DRIVER_STATUSES)[number];

export const ORDER_PRIORITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
export type OrderPriority = (typeof ORDER_PRIORITIES)[number];

export const ORDER_STATUSES = [
  "CREATED",
  "PLANNING",
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}
