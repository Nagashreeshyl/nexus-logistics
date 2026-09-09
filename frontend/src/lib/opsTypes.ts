import type { DeliveryStatus, ExceptionType } from "./deliveryStatus";

export type RiskLevel = "low" | "medium" | "high" | "critical" | string;

export interface OpsDelivery {
  id: string;
  organizationId: string;
  orderId: string;
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
  startedAt?: unknown;
  arrivedAt?: unknown;
  deliveredAt?: unknown;
  failReason?: string | null;
  lastLocation?: { lat: number; lon: number; synthetic?: boolean } | null;
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
  status?: string;
  userId?: string | null;
  assignedVehicleId?: string | null;
  lastLocation?: { lat: number; lon: number; synthetic?: boolean } | null;
  lastLocationAt?: unknown;
  synthetic?: boolean;
}

export interface OpsVehicle {
  id: string;
  organizationId: string;
  registrationNumber?: string;
  status?: string;
  availability?: string;
  assignedDriverId?: string | null;
  synthetic?: boolean;
}

export interface OpsOrder {
  id: string;
  organizationId: string;
  customerId?: string;
  address?: string;
  status?: string;
  priority?: string | number;
  assignedDriverUserId?: string | null;
  riskLevel?: RiskLevel;
  synthetic?: boolean;
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
