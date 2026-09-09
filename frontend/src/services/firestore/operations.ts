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

/**
 * Critical path timeout — surfaces errors instead of infinite "Writing…".
 * Under Firestore rate-limit / multi-listener load, updateDoc acks can exceed 10s
 * even when the server write already landed (onSnapshot updates first).
 */
const CRITICAL_WRITE_MS = 20_000;

function dbOrThrow() {
  const fb = getFirebase();
  if (!fb.configured) throw new Error(fb.reason);
  return fb.db;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms — check network / Firestore rules`));
    }, ms);
    promise.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (err) => {
        window.clearTimeout(t);
        reject(err);
      },
    );
  });
}

/**
 * Audit persistence policy (V2.15):
 * - Critical ops writes (delivery status, assignment) complete first and must succeed/fail clearly.
 * - Audit + notification are best-effort async: attempted after the critical write, never block CTAs.
 * - Failures are swallowed (logged to console) so a flaky audit path cannot hang the demo.
 */
async function writeAudit(params: {
  organizationId: string;
  actorUid: string;
  actorEmail: string;
  eventType: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
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

function enqueueAudit(params: Parameters<typeof writeAudit>[0]): void {
  void writeAudit(params).catch((err) => {
    console.warn("[audit best-effort failed]", params.eventType, err);
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
}): Promise<void> {
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

function enqueueNotification(params: Parameters<typeof pushNotification>[0]): void {
  void pushNotification(params).catch((err) => {
    console.warn("[notification best-effort failed]", params.type, err);
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

  // Critical path only — hang root cause was awaiting audit/notifications after this write.
  await withTimeout(
    updateDoc(doc(dbOrThrow(), "deliveries", delivery.id), patch),
    CRITICAL_WRITE_MS,
    "Delivery status write",
  );

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

  enqueueAudit({
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
    enqueueNotification({
      organizationId: delivery.organizationId,
      userId: uid,
      type: "delivery_status",
      title: `Delivery ${to}`,
      body: `${delivery.orderId} → ${to}`,
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
  await withTimeout(
    updateDoc(doc(dbOrThrow(), "deliveries", delivery.id), {
      driverUserId: params.driverUserId,
      driverId: params.driverId,
      driverName: params.driverName,
      status: delivery.status === "CREATED" ? "ASSIGNED" : delivery.status,
      updatedAt: serverTimestamp(),
    }),
    CRITICAL_WRITE_MS,
    "Delivery reassignment write",
  );

  enqueueAudit({
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

  enqueueNotification({
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
  const ref = await withTimeout(
    addDoc(collection(dbOrThrow(), "exceptions"), {
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
    }),
    CRITICAL_WRITE_MS,
    "Exception create",
  );

  enqueueAudit({
    organizationId: params.organizationId,
    actorUid: params.actorUid,
    actorEmail: params.actorEmail,
    eventType: "EXCEPTION_CREATED",
    entityType: "exception",
    entityId: ref.id,
    metadata: { type: params.type, deliveryId: params.deliveryId },
  });

  for (const uid of params.notifyUserIds ?? []) {
    enqueueNotification({
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
