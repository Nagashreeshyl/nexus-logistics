import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { assertTransition, DeliveryStatus, ExceptionType } from "../../lib/deliveryStatus";
import { getFirebase } from "../../firebase/config";
import type { OpsDelivery } from "../../lib/opsTypes";

function dbOrThrow() {
  const fb = getFirebase();
  if (!fb.configured) throw new Error(fb.reason);
  return fb.db;
}

async function writeAudit(params: {
  organizationId: string;
  actorUid: string;
  actorEmail: string;
  eventType: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  await addDoc(collection(dbOrThrow(), "auditLogs"), {
    organizationId: params.organizationId,
    actorId: params.actorUid,
    actorEmail: params.actorEmail,
    actorUid: params.actorUid,
    action: params.eventType,
    eventType: params.eventType,
    entityType: params.entityType,
    entityId: params.entityId,
    metadata: params.metadata ?? {},
    timestamp: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
}

async function pushNotification(params: {
  organizationId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
}) {
  if (!params.userId) return;
  await addDoc(collection(dbOrThrow(), "notifications"), {
    organizationId: params.organizationId,
    userId: params.userId,
    type: params.type,
    title: params.title,
    body: params.body,
    entityType: params.entityType ?? null,
    entityId: params.entityId ?? null,
    read: false,
    createdAt: serverTimestamp(),
  });
}

/**
 * Transition delivery status via Firestore write only.
 * UI must update from listeners — never patch React state directly here for "demo".
 */
export async function transitionDeliveryStatus(params: {
  delivery: OpsDelivery;
  to: DeliveryStatus;
  actorUid: string;
  actorEmail: string;
  notifyUserIds?: string[];
}): Promise<void> {
  const { delivery, to, actorUid, actorEmail } = params;
  assertTransition(delivery.status, to);
  const patch: {
    status: DeliveryStatus;
    updatedAt: ReturnType<typeof serverTimestamp>;
    startedAt?: ReturnType<typeof serverTimestamp>;
    arrivedAt?: ReturnType<typeof serverTimestamp>;
    deliveredAt?: ReturnType<typeof serverTimestamp>;
  } = {
    status: to,
    updatedAt: serverTimestamp(),
  };
  if (to === "EN_ROUTE") patch.startedAt = serverTimestamp();
  if (to === "ARRIVED") patch.arrivedAt = serverTimestamp();
  if (to === "DELIVERED") patch.deliveredAt = serverTimestamp();

  await updateDoc(doc(dbOrThrow(), "deliveries", delivery.id), patch);

  const eventType =
    to === "EN_ROUTE"
      ? "DELIVERY_STARTED"
      : to === "ARRIVED"
        ? "DELIVERY_ARRIVED"
        : to === "DELIVERED"
          ? "DELIVERY_COMPLETED"
          : to === "FAILED"
            ? "DELIVERY_FAILED"
            : "DELIVERY_STATUS_CHANGED";

  await writeAudit({
    organizationId: delivery.organizationId,
    actorUid,
    actorEmail,
    eventType,
    entityType: "delivery",
    entityId: delivery.id,
    metadata: { from: delivery.status, to, orderId: delivery.orderId },
  });

  const targets = new Set<string>(params.notifyUserIds ?? []);
  if (delivery.driverUserId) targets.add(delivery.driverUserId);
  for (const uid of targets) {
    await pushNotification({
      organizationId: delivery.organizationId,
      userId: uid,
      type: eventType,
      title: `Delivery ${delivery.orderId}`,
      body: `Status → ${to}`,
      entityType: "delivery",
      entityId: delivery.id,
    });
  }
}

export async function reassignDelivery(params: {
  delivery: OpsDelivery;
  driverUserId: string;
  driverId: string;
  driverName: string;
  actorUid: string;
  actorEmail: string;
}): Promise<void> {
  const { delivery } = params;
  await updateDoc(doc(dbOrThrow(), "deliveries", delivery.id), {
    driverUserId: params.driverUserId,
    driverId: params.driverId,
    driverName: params.driverName,
    status: delivery.status === "CREATED" ? "ASSIGNED" : delivery.status,
    updatedAt: serverTimestamp(),
  });

  await writeAudit({
    organizationId: delivery.organizationId,
    actorUid: params.actorUid,
    actorEmail: params.actorEmail,
    eventType: "DRIVER_REASSIGNED",
    entityType: "delivery",
    entityId: delivery.id,
    metadata: {
      fromDriverUserId: delivery.driverUserId,
      toDriverUserId: params.driverUserId,
      driverName: params.driverName,
    },
  });

  await pushNotification({
    organizationId: delivery.organizationId,
    userId: params.driverUserId,
    type: "DELIVERY_ASSIGNED",
    title: "New delivery assigned",
    body: `${delivery.orderId} → ${params.driverName}`,
    entityType: "delivery",
    entityId: delivery.id,
  });
}

export async function createException(params: {
  organizationId: string;
  type: ExceptionType;
  severity: string;
  message: string;
  deliveryId?: string;
  orderId?: string;
  driverId?: string;
  vehicleId?: string;
  actorUid: string;
  actorEmail: string;
  notifyUserIds?: string[];
  synthetic?: boolean;
}): Promise<string> {
  const ref = await addDoc(collection(dbOrThrow(), "exceptions"), {
    organizationId: params.organizationId,
    type: params.type,
    severity: params.severity,
    status: "open",
    message: params.message,
    deliveryId: params.deliveryId ?? null,
    orderId: params.orderId ?? null,
    driverId: params.driverId ?? null,
    vehicleId: params.vehicleId ?? null,
    synthetic: Boolean(params.synthetic),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    resolvedAt: null,
  });

  await writeAudit({
    organizationId: params.organizationId,
    actorUid: params.actorUid,
    actorEmail: params.actorEmail,
    eventType: "EXCEPTION_CREATED",
    entityType: "exception",
    entityId: ref.id,
    metadata: { type: params.type, deliveryId: params.deliveryId },
  });

  for (const uid of params.notifyUserIds ?? []) {
    await pushNotification({
      organizationId: params.organizationId,
      userId: uid,
      type: "EXCEPTION_CREATED",
      title: "Exception created",
      body: params.message,
      entityType: "exception",
      entityId: ref.id,
    });
  }

  return ref.id;
}

export async function touchPresence(params: {
  uid: string;
  activeRole: string;
}): Promise<void> {
  await updateDoc(doc(dbOrThrow(), "users", params.uid), {
    lastSeenAt: serverTimestamp(),
    lastActiveRole: params.activeRole,
    updatedAt: serverTimestamp(),
  });
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(dbOrThrow(), "notifications", id), {
    read: true,
    updatedAt: serverTimestamp(),
  });
}
