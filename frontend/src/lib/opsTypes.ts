import type { DeliveryStatus, ExceptionType } from "./deliveryStatus";
import type { DriverStatus, OrderPriority, OrderStatus, VehicleStatus, VehicleType } from "./opsEnums";

export type RiskLevel = "low" | "medium" | "high" | "critical" | string;

export interface OpsLocation {
  lat: number;
  lon: number;
  synthetic?: boolean;
}

export interface OpsDelivery {
  id: string;
  organizationId: string;
  orderId: string;
  customerId?: string | null;
  customerName?: string;
  destination?: string;
  routeId?: string | null;
  stopId?: string | null;
  sequence?: number;
  driverId?: string | null;
  driverUserId?: string | null;
  driverName?: string | null;
  vehicleId?: string | null;
  vehicleLabel?: string | null;
  status: DeliveryStatus;
  priority?: string | number;
  windowStart?: string;
  windowEnd?: string;
  etaMin?: number | null;
  riskLevel?: RiskLevel;
  riskScore?: number | null;
  exceptionOpen?: boolean;
  synthetic?: boolean;
  dataSource?: string;
  startedAt?: unknown;
  arrivedAt?: unknown;
  deliveredAt?: unknown;
  failReason?: string | null;
  lastLocation?: OpsLocation | null;
  lastLocationAt?: unknown;
  updatedAt?: unknown;
  createdAt?: unknown;
}

export interface OpsException {
  id: string;
  organizationId: string;
  type: ExceptionType | string;
  severity: "low" | "medium" | "high" | "critical" | string;
  status: "open" | "acknowledged" | "resolved" | string;
  orderId?: string | null;
  deliveryId?: string | null;
  driverId?: string | null;
  vehicleId?: string | null;
  message: string;
  synthetic?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
  resolvedAt?: unknown;
}

export interface OpsDriver {
  id: string;
  organizationId: string;
  name: string;
  phone?: string;
  licenseNumber?: string;
  licenseExpiry?: string | null;
  status?: DriverStatus | string;
  userId?: string | null;
  assignedVehicleId?: string | null;
  shiftStart?: string;
  shiftEnd?: string;
  currentLocation?: OpsLocation | null;
  locationTimestamp?: unknown;
  lastLocation?: OpsLocation | null;
  lastLocationAt?: unknown;
  active?: boolean;
  synthetic?: boolean;
  dataSource?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
  updatedBy?: string;
}

export interface OpsVehicle {
  id: string;
  organizationId: string;
  registrationNumber?: string;
  vehicleType?: VehicleType | string;
  type?: string;
  capacityKg?: number;
  volumeCapacity?: number;
  capacity?: number;
  status?: VehicleStatus | string;
  availability?: string;
  driverId?: string | null;
  assignedDriverId?: string | null;
  currentLocation?: OpsLocation | null;
  locationTimestamp?: unknown;
  fuelType?: string;
  active?: boolean;
  notes?: string;
  synthetic?: boolean;
  dataSource?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
  updatedBy?: string;
}

export interface OpsCustomer {
  id: string;
  organizationId: string;
  name: string;
  company?: string;
  phone?: string;
  email?: string;
  address: string;
  latitude: number;
  longitude: number;
  zone?: string;
  preferredDeliveryWindowStart?: string;
  preferredDeliveryWindowEnd?: string;
  preferredDeliveryWindow?: string;
  notes?: string;
  active?: boolean;
  synthetic?: boolean;
  dataSource?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
  updatedBy?: string;
}

export interface OpsOrder {
  id: string;
  organizationId: string;
  customerId?: string;
  customerName?: string;
  origin?: string;
  destination?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  demandKg?: number;
  volume?: number;
  priority?: OrderPriority | string | number;
  timeWindowStart?: string;
  timeWindowEnd?: string;
  serviceDurationMinutes?: number;
  requestedDate?: string;
  status?: OrderStatus | string;
  notes?: string;
  assignedDriverUserId?: string | null;
  assignedDriverId?: string | null;
  assignedVehicleId?: string | null;
  deliveryId?: string | null;
  riskLevel?: RiskLevel;
  synthetic?: boolean;
  dataSource?: string;
  active?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
  createdBy?: string;
  updatedBy?: string;
}

export interface OpsNotification {
  id: string;
  organizationId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  read: boolean;
  createdAt?: unknown;
}

export type SyncConnectionState = "loading" | "live" | "offline" | "error" | "permission_denied";
