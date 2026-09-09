/** Delivery lifecycle — centralized; never use free-form status strings in UI. */

export const DELIVERY_STATUSES = [
  "CREATED",
  "ASSIGNED",
  "EN_ROUTE",
  "ARRIVED",
  "DELIVERED",
  "FAILED",
] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

const ALLOWED: Record<DeliveryStatus, readonly DeliveryStatus[]> = {
  CREATED: ["ASSIGNED", "FAILED"],
  ASSIGNED: ["EN_ROUTE", "FAILED", "CREATED"],
  EN_ROUTE: ["ARRIVED", "FAILED"],
  ARRIVED: ["DELIVERED", "FAILED"],
  DELIVERED: [],
  FAILED: ["ASSIGNED"], // explicit recovery only
};

export function isDeliveryStatus(value: unknown): value is DeliveryStatus {
  return typeof value === "string" && (DELIVERY_STATUSES as readonly string[]).includes(value);
}

export function canTransition(from: DeliveryStatus, to: DeliveryStatus): boolean {
  if (from === to) return false;
  return ALLOWED[from].includes(to);
}

export function assertTransition(from: DeliveryStatus, to: DeliveryStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid delivery transition: ${from} → ${to}`);
  }
}

/** Next primary happy-path action for driver UI, if any. */
export function nextPrimaryTransition(from: DeliveryStatus): DeliveryStatus | null {
  const happy: Partial<Record<DeliveryStatus, DeliveryStatus>> = {
    ASSIGNED: "EN_ROUTE",
    EN_ROUTE: "ARRIVED",
    ARRIVED: "DELIVERED",
  };
  return happy[from] ?? null;
}

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  CREATED: "Created",
  ASSIGNED: "Assigned",
  EN_ROUTE: "En route",
  ARRIVED: "Arrived",
  DELIVERED: "Delivered",
  FAILED: "Failed",
};

export const EXCEPTION_TYPES = [
  "LATE_RISK",
  "VEHICLE_BREAKDOWN",
  "MISSED_WINDOW",
  "DELIVERY_FAILED",
  "ROUTE_DELAY",
  "DRIVER_UNAVAILABLE",
] as const;

export type ExceptionType = (typeof EXCEPTION_TYPES)[number];
