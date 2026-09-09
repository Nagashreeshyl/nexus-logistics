/**
 * Operational entity writes — always Firestore → listeners update UI.
 */
import {
  addDoc,
  collection,
  doc,
  getDoc,
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

function audit(
  organizationId: string,
  actorUid: string,
  actorEmail: string,
  eventType: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>,
) {
  // Non-blocking — operational write is authoritative; audit must not stall demo CTAs.
  void addDoc(collection(dbOrThrow(), "auditLogs"), {
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
  }).catch(() => undefined);
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

function rnd(n: number, seed: { v: number }) {
  // Deterministic LCG for hackathon demo reproducibility
  seed.v = (seed.v * 1664525 + 1013904223) >>> 0;
  return seed.v % n;
}

export async function generateSyntheticVehicle(actor: Actor, seed?: { v: number }): Promise<string> {
  const s = seed ?? { v: Date.now() >>> 0 };
  const type = VEHICLE_TYPES[rnd(VEHICLE_TYPES.length, s)];
  return createVehicle(actor, {
    registrationNumber: `KA-${String(10 + rnd(90, s)).padStart(2, "0")}-SY-${100 + rnd(899, s)}`,
    vehicleType: type,
    capacityKg: type === "BIKE" ? 40 : type === "VAN" ? 800 : 1500,
    volumeCapacity: type === "BIKE" ? 0.5 : 6,
    status: "AVAILABLE",
    fuelType: type === "EV" ? "ELECTRIC" : "DIESEL",
    notes: "Synthetic fleet unit",
    synthetic: true,
  });
}

export async function generateSyntheticDriver(actor: Actor, userId?: string | null, seed?: { v: number }): Promise<string> {
  const s = seed ?? { v: Date.now() >>> 0 };
  const names = ["Asha Rao", "Ravi Kumar", "Meera Iyer", "Arjun Nair", "Priya Shah"];
  return createDriver(actor, {
    name: names[rnd(names.length, s)],
    phone: `9${800000000 + rnd(99999999, s)}`,
    licenseNumber: `KA${100000 + rnd(899999, s)}`,
    status: "AVAILABLE",
    shiftStart: "08:00",
    shiftEnd: "18:00",
    userId: userId ?? null,
    synthetic: true,
  });
}

export async function generateSyntheticCustomer(actor: Actor, seed?: { v: number }): Promise<string> {
  const s = seed ?? { v: Date.now() >>> 0 };
  const names = ["Indiranagar Fresh", "Koramangala Mart", "HSR Foods", "Jayanagar Pharmacy", "Whitefield Hub"];
  const baseLat = 12.97 + (rnd(50, s) / 1000);
  const baseLon = 77.59 + (rnd(50, s) / 1000);
  return createCustomer(actor, {
    name: names[rnd(names.length, s)],
    company: "Synthetic Retail",
    phone: `9${700000000 + rnd(99999999, s)}`,
    email: `customer${rnd(9999, s)}@synthetic.nexus`,
    address: `${10 + rnd(90, s)} Demo Street, Bengaluru`,
    latitude: baseLat,
    longitude: baseLon,
    zone: ["NORTH", "SOUTH", "EAST", "WEST", "CENTRAL"][rnd(5, s)],
    preferredDeliveryWindowStart: "09:00",
    preferredDeliveryWindowEnd: "12:00",
    notes: "Synthetic customer",
    synthetic: true,
  });
}

export async function generateSyntheticOrder(actor: Actor, customer: OpsCustomer, seed?: { v: number }): Promise<string> {
  const s = seed ?? { v: Date.now() >>> 0 };
  return createOrder(actor, {
    customer,
    customerId: customer.id,
    customerName: customer.name,
    destination: customer.address,
    latitude: customer.latitude,
    longitude: customer.longitude,
    demandKg: 5 + rnd(40, s),
    volume: 1 + rnd(5, s),
    priority: ORDER_PRIORITIES[rnd(ORDER_PRIORITIES.length, s)],
    timeWindowStart: customer.preferredDeliveryWindowStart ?? "09:00",
    timeWindowEnd: customer.preferredDeliveryWindowEnd ?? "17:00",
    serviceDurationMinutes: 10 + rnd(20, s),
    requestedDate: new Date().toISOString().slice(0, 10),
    origin: "Nexus Depot",
    notes: "Synthetic order",
    synthetic: true,
  });
}

/** Creates a synthetic customer when none are available, then a synthetic order. */
export async function generateSyntheticOrderAuto(
  actor: Actor,
  existingCustomers: OpsCustomer[] = [],
  seed?: { v: number },
): Promise<string> {
  const s = seed ?? { v: Date.now() >>> 0 };
  let customer = existingCustomers.find((c) => c.active !== false) ?? existingCustomers[0];
  if (!customer) {
    const customerId = await generateSyntheticCustomer(actor, s);
    const snap = await getDoc(doc(dbOrThrow(), "customers", customerId));
    if (!snap.exists()) {
      throw new Error("Synthetic customer was created but could not be loaded");
    }
    customer = { id: snap.id, ...(snap.data() as Omit<OpsCustomer, "id">) };
  }
  return generateSyntheticOrder(actor, customer, s);
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Math.min(Math.max(1, concurrency), Math.max(1, items.length));
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}

export async function generateOperationalScenario(
  actor: Actor,
  counts: { vehicles: number; drivers: number; customers: number; orders: number; seed?: number },
  linkUserId?: string | null,
  onProgress?: (msg: string) => void,
): Promise<{ vehicleIds: string[]; driverIds: string[]; customerIds: string[]; orderIds: string[] }> {
  const seed = { v: (counts.seed ?? 20260909) >>> 0 };
  const vehicleIds: string[] = [];
  const driverIds: string[] = [];
  const customerIds: string[] = [];
  const orderIds: string[] = [];
  const progress = (msg: string) => onProgress?.(msg);

  progress(`Generating fleet (${counts.vehicles})…`);
  for (let i = 0; i < counts.vehicles; i++) vehicleIds.push(await generateSyntheticVehicle(actor, seed));

  progress(`Generating drivers (${counts.drivers})…`);
  for (let i = 0; i < counts.drivers; i++) {
    driverIds.push(await generateSyntheticDriver(actor, i === 0 ? linkUserId ?? null : null, seed));
  }

  progress(`Generating customers (${counts.customers})…`);
  for (let i = 0; i < counts.customers; i++) customerIds.push(await generateSyntheticCustomer(actor, seed));

  // Pair first N drivers/vehicles
  const pairN = Math.min(vehicleIds.length, driverIds.length);
  progress(`Pairing ${pairN} drivers ↔ vehicles…`);
  for (let i = 0; i < pairN; i++) {
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

  progress(`Generating orders (${counts.orders})…`);
  // Pre-draw coords with the LCG so parallel workers stay deterministic.
  const orderSpecs = Array.from({ length: counts.orders }, (_, i) => {
    const cid = customerIds[i % customerIds.length];
    const lat = 12.95 + rnd(60, seed) / 1000;
    const lon = 77.58 + rnd(60, seed) / 1000;
    return { i, cid, lat, lon };
  });

  let created = 0;
  const createdIds = await mapPool(orderSpecs, 4, async (spec) => {
    const id = await createOrder(actor, {
      customer: {
        id: spec.cid,
        organizationId: actor.organizationId,
        name: `Scenario Customer ${spec.i + 1}`,
        address: `${20 + spec.i} Scenario Rd, Bengaluru`,
        latitude: spec.lat,
        longitude: spec.lon,
        active: true,
        preferredDeliveryWindowStart: "09:00",
        preferredDeliveryWindowEnd: "17:00",
      },
      customerId: spec.cid,
      customerName: `Scenario Customer ${spec.i + 1}`,
      destination: `${20 + spec.i} Scenario Rd, Bengaluru`,
      latitude: spec.lat,
      longitude: spec.lon,
      demandKg: 8 + (spec.i % 20),
      volume: 1,
      priority: ORDER_PRIORITIES[spec.i % ORDER_PRIORITIES.length],
      timeWindowStart: "09:00",
      timeWindowEnd: "17:00",
      serviceDurationMinutes: 15,
      requestedDate: new Date().toISOString().slice(0, 10),
      synthetic: true,
    });
    created += 1;
    if (created === 1 || created % 4 === 0 || created === counts.orders) {
      progress(`Orders ${created}/${counts.orders}…`);
    }
    return id;
  });
  orderIds.push(...createdIds);

  // Non-blocking audit — do not await
  audit(actor.organizationId, actor.uid, actor.email, "SEED_OPERATIONAL_SCENARIO", "scenario", "ops-seed", {
    ...counts,
    synthetic: true,
  });

  progress("Scenario publish complete");
  return { vehicleIds, driverIds, customerIds, orderIds };
}
