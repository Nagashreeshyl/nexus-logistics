import {
  DRIVER_STATUSES,
  ORDER_PRIORITIES,
  ORDER_STATUSES,
  VEHICLE_STATUSES,
  VEHICLE_TYPES,
  isOneOf,
  type DriverStatus,
  type OrderPriority,
  type OrderStatus,
  type VehicleStatus,
  type VehicleType,
} from "./opsEnums";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function requireNonEmpty(label: string, value: string | null | undefined): string {
  const v = (value ?? "").trim();
  if (!v) throw new ValidationError(`${label} is required`);
  return v;
}

export function requirePositive(label: string, value: number): number {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    throw new ValidationError(`${label} must be > 0`);
  }
  return value;
}

export function requireNonNegative(label: string, value: number): number {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    throw new ValidationError(`${label} must be ≥ 0`);
  }
  return value;
}

export function requireCoord(label: string, value: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new ValidationError(`${label} must be a number`);
  }
  return value;
}

export function requireWindow(start: string, end: string): { start: string; end: string } {
  const s = requireNonEmpty("timeWindowStart", start);
  const e = requireNonEmpty("timeWindowEnd", end);
  if (s >= e) throw new ValidationError("timeWindowStart must be before timeWindowEnd");
  return { start: s, end: e };
}

export function validateVehicleInput(input: {
  registrationNumber: string;
  vehicleType: string;
  capacityKg: number;
  volumeCapacity: number;
  status: string;
  fuelType?: string;
}) {
  if (!isOneOf(input.vehicleType, VEHICLE_TYPES)) throw new ValidationError("Invalid vehicleType");
  if (!isOneOf(input.status, VEHICLE_STATUSES)) throw new ValidationError("Invalid vehicle status");
  return {
    registrationNumber: requireNonEmpty("registrationNumber", input.registrationNumber),
    vehicleType: input.vehicleType as VehicleType,
    capacityKg: requirePositive("capacityKg", input.capacityKg),
    volumeCapacity: requireNonNegative("volumeCapacity", input.volumeCapacity),
    status: input.status as VehicleStatus,
    fuelType: (input.fuelType ?? "DIESEL").trim() || "DIESEL",
  };
}

export function validateDriverInput(input: {
  name: string;
  phone?: string;
  licenseNumber?: string;
  status: string;
  shiftStart?: string;
  shiftEnd?: string;
}) {
  if (!isOneOf(input.status, DRIVER_STATUSES)) throw new ValidationError("Invalid driver status");
  return {
    name: requireNonEmpty("name", input.name),
    phone: (input.phone ?? "").trim(),
    licenseNumber: (input.licenseNumber ?? "").trim(),
    status: input.status as DriverStatus,
    shiftStart: input.shiftStart ?? "08:00",
    shiftEnd: input.shiftEnd ?? "18:00",
  };
}

export function validateCustomerInput(input: {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  preferredDeliveryWindowStart?: string;
  preferredDeliveryWindowEnd?: string;
}) {
  const win = requireWindow(
    input.preferredDeliveryWindowStart ?? "09:00",
    input.preferredDeliveryWindowEnd ?? "17:00",
  );
  return {
    name: requireNonEmpty("name", input.name),
    address: requireNonEmpty("address", input.address),
    latitude: requireCoord("latitude", input.latitude),
    longitude: requireCoord("longitude", input.longitude),
    preferredDeliveryWindowStart: win.start,
    preferredDeliveryWindowEnd: win.end,
  };
}

export function validateOrderInput(input: {
  customerId: string;
  customerName: string;
  destination: string;
  latitude: number;
  longitude: number;
  demandKg: number;
  volume: number;
  priority: string;
  timeWindowStart: string;
  timeWindowEnd: string;
  serviceDurationMinutes: number;
  requestedDate: string;
  status?: string;
}) {
  const win = requireWindow(input.timeWindowStart, input.timeWindowEnd);
  if (!isOneOf(input.priority, ORDER_PRIORITIES)) throw new ValidationError("Invalid priority");
  const status = input.status ?? "CREATED";
  if (!isOneOf(status, ORDER_STATUSES)) throw new ValidationError("Invalid order status");
  requireNonEmpty("requestedDate", input.requestedDate);
  return {
    customerId: requireNonEmpty("customerId", input.customerId),
    customerName: requireNonEmpty("customerName", input.customerName),
    destination: requireNonEmpty("destination", input.destination),
    latitude: requireCoord("latitude", input.latitude),
    longitude: requireCoord("longitude", input.longitude),
    demandKg: requirePositive("demandKg", input.demandKg),
    volume: requireNonNegative("volume", input.volume),
    priority: input.priority as OrderPriority,
    timeWindowStart: win.start,
    timeWindowEnd: win.end,
    serviceDurationMinutes: requirePositive("serviceDurationMinutes", input.serviceDurationMinutes),
    requestedDate: input.requestedDate,
    status: status as OrderStatus,
  };
}

export function assertAssignableVehicle(
  vehicle: { active?: boolean; status?: string; organizationId: string; capacityKg?: number },
  organizationId: string,
  demandKg?: number,
): void {
  if (vehicle.organizationId !== organizationId) throw new ValidationError("Vehicle organization mismatch");
  if (vehicle.active === false || vehicle.status === "INACTIVE") {
    throw new ValidationError("Cannot assign inactive vehicle");
  }
  if (vehicle.status === "BREAKDOWN" || vehicle.status === "MAINTENANCE") {
    throw new ValidationError("Vehicle is not available for assignment");
  }
  if (demandKg != null && vehicle.capacityKg != null && demandKg > vehicle.capacityKg) {
    throw new ValidationError("Vehicle capacity insufficient for demand");
  }
}

export function assertAssignableDriver(
  driver: { active?: boolean; status?: string; organizationId: string },
  organizationId: string,
): void {
  if (driver.organizationId !== organizationId) throw new ValidationError("Driver organization mismatch");
  if (driver.active === false) throw new ValidationError("Cannot assign deactivated driver");
  if (driver.status === "UNAVAILABLE" || driver.status === "OFF_DUTY") {
    throw new ValidationError("Driver is not available for assignment");
  }
}
