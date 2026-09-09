/**
 * Operational entity writes — always Firestore → listeners update UI.
 */
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getFirebase } from "../../firebase/config";
import { createException } from "./operations";
import {
  assertAssignableDriver,
  assertAssignableVehicle,
  validateCustomerInput,
  validateDriverInput,
  validateOrderInput,
  validateVehicleInput,
  ValidationError,
} from "../../lib/opsValidation";
import type { OpsCustomer, OpsDriver, OpsOrder, OpsVehicle } from "../../lib/opsTypes";
import type { DriverStatus, VehicleStatus } from "../../lib/opsEnums";
import { VEHICLE_TYPES, ORDER_PRIORITIES } from "../../lib/opsEnums";

function dbOrThrow() {
  const fb = getFirebase();
  if (!fb.configured) throw new Error(fb.reason);
  return fb.db;
}

async function audit(
  organizationId: string,
  actorUid: string,
  actorEmail: string,
  eventType: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>,
) {
  await addDoc(collection(dbOrThrow(), "auditLogs"), {
    organizationId,
    actorId: actorUid,
    actorUid,
    actorEmail,
    action: eventType,
    eventType,
    entityType,
    entityId,
    metadata: metadata ?? {},
    timestamp: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
}

type Actor = { uid: string; email: string; organizationId: string };

export async function createVehicle(
  actor: Actor,
  input: Parameters<typeof validateVehicleInput>[0] & {
    notes?: string;
    driverId?: string | null;
    synthetic?: boolean;
  },
): Promise<string> {
  const v = validateVehicleInput(input);
  const ref = await addDoc(collection(dbOrThrow(), "vehicles"), {
    ...v,
    type: v.vehicleType,
    capacity: v.capacityKg,
    driverId: input.driverId ?? null,
    assignedDriverId: input.driverId ?? null,
    currentLocation: { lat: 12.9716, lon: 77.5946, synthetic: true },
    locationTimestamp: serverTimestamp(),
    active: v.status !== "INACTIVE",
    notes: input.notes ?? "",
    organizationId: actor.organizationId,
    synthetic: Boolean(input.synthetic),
    dataSource: input.synthetic ? "synthetic" : "manual",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: actor.uid,
    updatedBy: actor.uid,
  });
  await audit(actor.organizationId, actor.uid, actor.email, "VEHICLE_CREATED", "vehicle", ref.id);
  return ref.id;
}

export async function updateVehicle(
  actor: Actor,
  vehicleId: string,
  patch: Partial<{
    registrationNumber: string;
    vehicleType: string;
    capacityKg: number;
    volumeCapacity: number;
    status: string;
    fuelType: string;
    notes: string;
    active: boolean;
  }>,
): Promise<void> {
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  };
  if (patch.registrationNumber != null) payload.registrationNumber = patch.registrationNumber;
  if (patch.vehicleType != null) {
    payload.vehicleType = patch.vehicleType;
    payload.type = patch.vehicleType;
  }
  if (patch.capacityKg != null) {
    payload.capacityKg = patch.capacityKg;
    payload.capacity = patch.capacityKg;
  }
  if (patch.volumeCapacity != null) payload.volumeCapacity = patch.volumeCapacity;
  if (patch.status != null) {
    payload.status = patch.status;
    payload.active = patch.status !== "INACTIVE";
  }
  if (patch.fuelType != null) payload.fuelType = patch.fuelType;
  if (patch.notes != null) payload.notes = patch.notes;
  if (patch.active != null) payload.active = patch.active;

  await updateDoc(doc(dbOrThrow(), "vehicles", vehicleId), payload as Record<string, import("firebase/firestore").FieldValue | string | number | boolean | null>);
  await audit(actor.organizationId, actor.uid, actor.email, "VEHICLE_UPDATED", "vehicle", vehicleId, patch);

  if (patch.status === "BREAKDOWN") {
    await createException({
      organizationId: actor.organizationId,
      type: "VEHICLE_BREAKDOWN",
      severity: "high",
      message: `Vehicle ${vehicleId} marked BREAKDOWN`,
      vehicleId,
      actorUid: actor.uid,
      actorEmail: actor.email,
      synthetic: false,
    });
  }
}

export async function deactivateVehicle(actor: Actor, vehicleId: string): Promise<void> {
  await updateDoc(doc(dbOrThrow(), "vehicles", vehicleId), {
    status: "INACTIVE" satisfies VehicleStatus,
    active: false,
    driverId: null,
    assignedDriverId: null,
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });
  await audit(actor.organizationId, actor.uid, actor.email, "VEHICLE_DEACTIVATED", "vehicle", vehicleId);
}

export async function createDriver(
  actor: Actor,
  input: Parameters<typeof validateDriverInput>[0] & {
    userId?: string | null;
    licenseExpiry?: string | null;
    assignedVehicleId?: string | null;
    synthetic?: boolean;
  },
): Promise<string> {
  const d = validateDriverInput(input);
  const ref = await addDoc(collection(dbOrThrow(), "drivers"), {
    ...d,
    userId: input.userId ?? null,
    licenseExpiry: input.licenseExpiry ?? null,
    assignedVehicleId: input.assignedVehicleId ?? null,
    currentLocation: { lat: 12.9716, lon: 77.5946, synthetic: true },
    locationTimestamp: serverTimestamp(),
    active: true,
    organizationId: actor.organizationId,
    synthetic: Boolean(input.synthetic),
    dataSource: input.synthetic ? "synthetic" : "manual",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: actor.uid,
    updatedBy: actor.uid,
  });
  await audit(actor.organizationId, actor.uid, actor.email, "DRIVER_CREATED", "driver", ref.id);
  return ref.id;
}

export async function updateDriver(
  actor: Actor,
  driverId: string,
  patch: Partial<{
    name: string;
    phone: string;
    licenseNumber: string;
    licenseExpiry: string | null;
    status: string;
    shiftStart: string;
    shiftEnd: string;
    userId: string | null;
    active: boolean;
  }>,
): Promise<void> {
  const payload: Record<string, unknown> = {
    ...patch,
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  };
  await updateDoc(doc(dbOrThrow(), "drivers", driverId), payload as Record<string, import("firebase/firestore").FieldValue | string | number | boolean | null>);
  await audit(actor.organizationId, actor.uid, actor.email, "DRIVER_UPDATED", "driver", driverId, patch);

  if (patch.status === "UNAVAILABLE") {
    await createException({
      organizationId: actor.organizationId,
      type: "DRIVER_UNAVAILABLE",
      severity: "medium",
      message: `Driver ${driverId} marked UNAVAILABLE`,
      driverId,
      actorUid: actor.uid,
      actorEmail: actor.email,
    });
  }
}

export async function deactivateDriver(actor: Actor, driverId: string): Promise<void> {
  await updateDoc(doc(dbOrThrow(), "drivers", driverId), {
    active: false,
    status: "UNAVAILABLE" satisfies DriverStatus,
    assignedVehicleId: null,
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });
  await audit(actor.organizationId, actor.uid, actor.email, "DRIVER_UPDATED", "driver", driverId, {
    deactivated: true,
  });
}

export async function assignDriverVehicle(params: {
  actor: Actor;
  driver: OpsDriver;
  vehicle: OpsVehicle;
}): Promise<void> {
  const { actor, driver, vehicle } = params;
  assertAssignableDriver(driver, actor.organizationId);
  assertAssignableVehicle(vehicle, actor.organizationId);

  await updateDoc(doc(dbOrThrow(), "drivers", driver.id), {
    assignedVehicleId: vehicle.id,
    status: "ASSIGNED",
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });
  await updateDoc(doc(dbOrThrow(), "vehicles", vehicle.id), {
    driverId: driver.id,
    assignedDriverId: driver.id,
    status: "ASSIGNED",
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });
  await audit(actor.organizationId, actor.uid, actor.email, "DRIVER_ASSIGNED", "driver", driver.id, {
    vehicleId: vehicle.id,
  });
}

export async function unassignDriverVehicle(params: {
  actor: Actor;
  driver: OpsDriver;
}): Promise<void> {
  const { actor, driver } = params;
  const vehicleId = driver.assignedVehicleId;
  await updateDoc(doc(dbOrThrow(), "drivers", driver.id), {
    assignedVehicleId: null,
    status: "AVAILABLE",
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });
  if (vehicleId) {
    await updateDoc(doc(dbOrThrow(), "vehicles", vehicleId), {
      driverId: null,
      assignedDriverId: null,
      status: "AVAILABLE",
      updatedAt: serverTimestamp(),
      updatedBy: actor.uid,
    });
  }
  await audit(actor.organizationId, actor.uid, actor.email, "DRIVER_UNASSIGNED", "driver", driver.id, {
    vehicleId,
  });
}

export async function createCustomer(
  actor: Actor,
  input: Parameters<typeof validateCustomerInput>[0] & {
    company?: string;
    phone?: string;
    email?: string;
    zone?: string;
    notes?: string;
    synthetic?: boolean;
  },
): Promise<string> {
  const c = validateCustomerInput(input);
  const ref = await addDoc(collection(dbOrThrow(), "customers"), {
    ...c,
    company: input.company ?? "",
    phone: input.phone ?? "",
    email: input.email ?? "",
    zone: input.zone ?? "CENTRAL",
    preferredDeliveryWindow: `${c.preferredDeliveryWindowStart}-${c.preferredDeliveryWindowEnd}`,
    notes: input.notes ?? "",
    active: true,
    organizationId: actor.organizationId,
    synthetic: Boolean(input.synthetic),
    dataSource: input.synthetic ? "synthetic" : "manual",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: actor.uid,
    updatedBy: actor.uid,
  });
  await audit(actor.organizationId, actor.uid, actor.email, "CUSTOMER_CREATED", "customer", ref.id);
  return ref.id;
}

export async function updateCustomer(
  actor: Actor,
  customerId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await updateDoc(doc(dbOrThrow(), "customers", customerId), {
    ...patch,
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });
  await audit(actor.organizationId, actor.uid, actor.email, "CUSTOMER_UPDATED", "customer", customerId);
}

export async function deactivateCustomer(actor: Actor, customerId: string): Promise<void> {
  await updateCustomer(actor, customerId, { active: false });
}

export async function createOrder(
  actor: Actor,
  input: Parameters<typeof validateOrderInput>[0] & {
    origin?: string;
    notes?: string;
    customer: OpsCustomer;
    synthetic?: boolean;
  },
): Promise<string> {
  if (input.customer.organizationId !== actor.organizationId) {
    throw new ValidationError("Customer does not belong to organization");
  }
  if (input.customer.active === false) throw new ValidationError("Customer is inactive");
  const o = validateOrderInput({
    ...input,
    customerId: input.customer.id,
    customerName: input.customer.name,
    destination: input.destination || input.customer.address,
    latitude: input.latitude ?? input.customer.latitude,
    longitude: input.longitude ?? input.customer.longitude,
  });
  const ref = await addDoc(collection(dbOrThrow(), "orders"), {
    ...o,
    origin: input.origin ?? "Nexus Depot",
    address: o.destination,
    notes: input.notes ?? "",
    assignedDriverId: null,
    assignedDriverUserId: null,
    assignedVehicleId: null,
    deliveryId: null,
    organizationId: actor.organizationId,
    synthetic: Boolean(input.synthetic),
    dataSource: input.synthetic ? "synthetic" : "manual",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: actor.uid,
    updatedBy: actor.uid,
  });
  await audit(actor.organizationId, actor.uid, actor.email, "ORDER_CREATED", "order", ref.id);
  return ref.id;
}

export async function cancelOrder(actor: Actor, order: OpsOrder): Promise<void> {
  if (order.status === "COMPLETED" || order.status === "CANCELLED") {
    throw new ValidationError(`Cannot cancel order in status ${order.status}`);
  }
  await updateDoc(doc(dbOrThrow(), "orders", order.id), {
    status: "CANCELLED",
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });
  await audit(actor.organizationId, actor.uid, actor.email, "ORDER_CANCELLED", "order", order.id);
}

/** Manual assignment: creates/updates delivery + links order. */
export async function assignOrderDelivery(params: {
  actor: Actor;
  order: OpsOrder;
  driver: OpsDriver;
  vehicle: OpsVehicle;
}): Promise<string> {
  const { actor, order, driver, vehicle } = params;
  if (order.organizationId !== actor.organizationId) throw new ValidationError("Order org mismatch");
  assertAssignableDriver(driver, actor.organizationId);
  assertAssignableVehicle(vehicle, actor.organizationId, order.demandKg);
  if (!driver.userId) throw new ValidationError("Driver has no linked Firebase userId");

  const deliveryPayload = {
    orderId: order.id,
    customerId: order.customerId ?? null,
    customerName: order.customerName ?? "",
    destination: order.destination ?? order.address ?? "",
    routeId: null,
    sequence: 1,
    driverId: driver.id,
    driverUserId: driver.userId,
    driverName: driver.name,
    vehicleId: vehicle.id,
    vehicleLabel: vehicle.registrationNumber ?? vehicle.id,
    status: "ASSIGNED" as const,
    priority: String(order.priority ?? "MEDIUM"),
    windowStart: order.timeWindowStart ?? "09:00",
    windowEnd: order.timeWindowEnd ?? "17:00",
    etaMin: 45,
    riskLevel: "medium",
    riskScore: 0.35,
    exceptionOpen: false,
    organizationId: actor.organizationId,
    synthetic: Boolean(order.synthetic),
    dataSource: order.dataSource ?? "manual",
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    createdBy: actor.uid,
    updatedBy: actor.uid,
  };

  let deliveryId = order.deliveryId ?? null;
  if (deliveryId) {
    await updateDoc(doc(dbOrThrow(), "deliveries", deliveryId), deliveryPayload);
    await audit(actor.organizationId, actor.uid, actor.email, "DELIVERY_REASSIGNED", "delivery", deliveryId, {
      orderId: order.id,
      driverId: driver.id,
    });
  } else {
    const ref = await addDoc(collection(dbOrThrow(), "deliveries"), deliveryPayload);
    deliveryId = ref.id;
    await audit(actor.organizationId, actor.uid, actor.email, "DELIVERY_ASSIGNED", "delivery", deliveryId, {
      orderId: order.id,
      driverId: driver.id,
    });
  }

  await updateDoc(doc(dbOrThrow(), "orders", order.id), {
    status: "ASSIGNED",
    assignedDriverId: driver.id,
    assignedDriverUserId: driver.userId,
    assignedVehicleId: vehicle.id,
    deliveryId,
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid,
  });

  await addDoc(collection(dbOrThrow(), "notifications"), {
    organizationId: actor.organizationId,
    userId: driver.userId,
    type: "DELIVERY_ASSIGNED",
    title: "New delivery assigned",
    body: `${order.id} → ${driver.name}`,
    entityType: "delivery",
    entityId: deliveryId,
    read: false,
    createdAt: serverTimestamp(),
  });

  return deliveryId;
}

function rnd(n: number) {
  return Math.floor(Math.random() * n);
}

export async function generateSyntheticVehicle(actor: Actor): Promise<string> {
  const type = VEHICLE_TYPES[rnd(VEHICLE_TYPES.length)];
  return createVehicle(actor, {
    registrationNumber: `KA-${String(10 + rnd(90)).padStart(2, "0")}-SY-${100 + rnd(899)}`,
    vehicleType: type,
    capacityKg: type === "BIKE" ? 40 : type === "VAN" ? 800 : 1500,
    volumeCapacity: type === "BIKE" ? 0.5 : 6,
    status: "AVAILABLE",
    fuelType: type === "EV" ? "ELECTRIC" : "DIESEL",
    notes: "Synthetic fleet unit",
    synthetic: true,
  });
}

export async function generateSyntheticDriver(actor: Actor, userId?: string | null): Promise<string> {
  const names = ["Asha Rao", "Ravi Kumar", "Meera Iyer", "Arjun Nair", "Priya Shah"];
  return createDriver(actor, {
    name: names[rnd(names.length)],
    phone: `9${800000000 + rnd(99999999)}`,
    licenseNumber: `KA${100000 + rnd(899999)}`,
    status: "AVAILABLE",
    shiftStart: "08:00",
    shiftEnd: "18:00",
    userId: userId ?? null,
    synthetic: true,
  });
}

export async function generateSyntheticCustomer(actor: Actor): Promise<string> {
  const names = ["Indiranagar Fresh", "Koramangala Mart", "HSR Foods", "Jayanagar Pharmacy", "Whitefield Hub"];
  const baseLat = 12.97 + Math.random() * 0.05;
  const baseLon = 77.59 + Math.random() * 0.05;
  return createCustomer(actor, {
    name: names[rnd(names.length)],
    company: "Synthetic Retail",
    phone: `9${700000000 + rnd(99999999)}`,
    email: `customer${rnd(9999)}@synthetic.nexus`,
    address: `${10 + rnd(90)} Demo Street, Bengaluru`,
    latitude: baseLat,
    longitude: baseLon,
    zone: ["NORTH", "SOUTH", "EAST", "WEST", "CENTRAL"][rnd(5)],
    preferredDeliveryWindowStart: "09:00",
    preferredDeliveryWindowEnd: "12:00",
    notes: "Synthetic customer",
    synthetic: true,
  });
}

export async function generateSyntheticOrder(actor: Actor, customer: OpsCustomer): Promise<string> {
  return createOrder(actor, {
    customer,
    customerId: customer.id,
    customerName: customer.name,
    destination: customer.address,
    latitude: customer.latitude,
    longitude: customer.longitude,
    demandKg: 5 + rnd(40),
    volume: 1 + rnd(5),
    priority: ORDER_PRIORITIES[rnd(ORDER_PRIORITIES.length)],
    timeWindowStart: customer.preferredDeliveryWindowStart ?? "09:00",
    timeWindowEnd: customer.preferredDeliveryWindowEnd ?? "17:00",
    serviceDurationMinutes: 10 + rnd(20),
    requestedDate: new Date().toISOString().slice(0, 10),
    origin: "Nexus Depot",
    notes: "Synthetic order",
    synthetic: true,
  });
}

export async function generateOperationalScenario(
  actor: Actor,
  counts: { vehicles: number; drivers: number; customers: number; orders: number },
  linkUserId?: string | null,
): Promise<{ vehicleIds: string[]; driverIds: string[]; customerIds: string[]; orderIds: string[] }> {
  const vehicleIds: string[] = [];
  const driverIds: string[] = [];
  const customerIds: string[] = [];
  const orderIds: string[] = [];

  for (let i = 0; i < counts.vehicles; i++) vehicleIds.push(await generateSyntheticVehicle(actor));
  for (let i = 0; i < counts.drivers; i++) {
    driverIds.push(await generateSyntheticDriver(actor, i === 0 ? linkUserId ?? null : null));
  }
  for (let i = 0; i < counts.customers; i++) customerIds.push(await generateSyntheticCustomer(actor));

  // Pair first N drivers/vehicles
  const pairN = Math.min(vehicleIds.length, driverIds.length);
  for (let i = 0; i < pairN; i++) {
    // lightweight link without full assert if freshly created AVAILABLE
    await updateDoc(doc(dbOrThrow(), "drivers", driverIds[i]), {
      assignedVehicleId: vehicleIds[i],
      status: "ASSIGNED",
      updatedAt: serverTimestamp(),
    });
    await updateDoc(doc(dbOrThrow(), "vehicles", vehicleIds[i]), {
      driverId: driverIds[i],
      assignedDriverId: driverIds[i],
      status: "ASSIGNED",
      updatedAt: serverTimestamp(),
    });
  }

  for (let i = 0; i < counts.orders; i++) {
    const cid = customerIds[i % customerIds.length];
    // customer docs just created — reconstruct minimal OpsCustomer
    const customer: OpsCustomer = {
      id: cid,
      organizationId: actor.organizationId,
      name: `Synthetic Customer ${i + 1}`,
      address: "Synthetic address",
      latitude: 12.97,
      longitude: 77.59,
      active: true,
      preferredDeliveryWindowStart: "09:00",
      preferredDeliveryWindowEnd: "17:00",
    };
    // Prefer using generate after fetch isn't available — createOrder needs real name/coords from createCustomer
    // Re-create via generateSyntheticOrder requires full customer; fetch from last create path:
    orderIds.push(
      await createOrder(actor, {
        customer: {
          ...customer,
          name: `Scenario Customer ${i + 1}`,
          address: `${20 + i} Scenario Rd, Bengaluru`,
          latitude: 12.95 + Math.random() * 0.06,
          longitude: 77.58 + Math.random() * 0.06,
        },
        customerId: cid,
        customerName: `Scenario Customer ${i + 1}`,
        destination: `${20 + i} Scenario Rd, Bengaluru`,
        latitude: 12.95 + Math.random() * 0.06,
        longitude: 77.58 + Math.random() * 0.06,
        demandKg: 8 + (i % 20),
        volume: 1,
        priority: ORDER_PRIORITIES[i % ORDER_PRIORITIES.length],
        timeWindowStart: "09:00",
        timeWindowEnd: "17:00",
        serviceDurationMinutes: 15,
        requestedDate: new Date().toISOString().slice(0, 10),
        synthetic: true,
      }),
    );
  }

  await audit(actor.organizationId, actor.uid, actor.email, "SEED_OPERATIONAL_SCENARIO", "scenario", "ops-seed", {
    ...counts,
    synthetic: true,
  });

  return { vehicleIds, driverIds, customerIds, orderIds };
}
