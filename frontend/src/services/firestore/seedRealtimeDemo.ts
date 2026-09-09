import { addDoc, collection, doc, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { getFirebase } from "../../firebase/config";

function dbOrThrow() {
  const fb = getFirebase();
  if (!fb.configured) throw new Error(fb.reason);
  return fb.db;
}

/**
 * Controlled synthetic seed — writes real Firestore docs (synthetic: true).
 * Used by Realtime Test Console. Not permanent fake React state.
 */
export async function seedRealtimeDemo(params: {
  organizationId: string;
  actorUid: string;
  actorEmail: string;
  /** Optional second driver Firebase UID for reassignment demos */
  altDriverUserId?: string | null;
}): Promise<{ deliveryIds: string[]; driverIds: string[] }> {
  const db = dbOrThrow();
  const org = params.organizationId;
  const batch = writeBatch(db);

  const driverSelf = doc(collection(db, "drivers"));
  const driverAlt = doc(collection(db, "drivers"));
  const vehicleA = doc(collection(db, "vehicles"));
  const vehicleB = doc(collection(db, "vehicles"));

  batch.set(driverSelf, {
    name: "Self (demo)",
    employeeId: "DRV-SELF",
    status: "ASSIGNED",
    userId: params.actorUid,
    assignedVehicleId: vehicleA.id,
    organizationId: org,
    synthetic: true,
    lastLocation: { lat: 12.9716, lon: 77.5946, synthetic: true },
    lastLocationAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: params.actorUid,
  });

  batch.set(driverAlt, {
    name: "Arjun (demo)",
    employeeId: "DRV-ARJUN",
    status: "AVAILABLE",
    userId: params.altDriverUserId ?? null,
    assignedVehicleId: vehicleB.id,
    organizationId: org,
    synthetic: true,
    lastLocation: { lat: 12.9352, lon: 77.6245, synthetic: true },
    lastLocationAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: params.actorUid,
  });

  batch.set(vehicleA, {
    registrationNumber: "KA-01-RT-101",
    type: "van",
    capacity: 40,
    status: "ASSIGNED",
    availability: "in_use",
    assignedDriverId: driverSelf.id,
    organizationId: org,
    synthetic: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(vehicleB, {
    registrationNumber: "KA-01-RT-202",
    type: "van",
    capacity: 35,
    status: "AVAILABLE",
    availability: "available",
    assignedDriverId: driverAlt.id,
    organizationId: org,
    synthetic: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();

  // Link current user profile to driver record (admin/self fields: driverId needs admin in rules —
  // skip if permission denied; seed still works for deliveries using driverUserId).
  try {
    await setDoc(
      doc(db, "users", params.actorUid),
      { driverId: driverSelf.id, updatedAt: serverTimestamp() },
      { merge: true },
    );
  } catch {
    /* rules may block driverId change for non-admin — OK */
  }

  const deliveries = [
    {
      orderId: "ORD-RT-1024",
      customerName: "Indiranagar Fresh",
      destination: "12th Main, Indiranagar, Bengaluru",
      sequence: 1,
      status: "ASSIGNED",
      priority: "high",
      windowStart: "09:00",
      windowEnd: "11:00",
      etaMin: 42,
      riskLevel: "medium",
      riskScore: 0.41,
      driverUserId: params.actorUid,
      driverId: driverSelf.id,
      driverName: "Self (demo)",
      vehicleId: vehicleA.id,
      vehicleLabel: "KA-01-RT-101",
    },
    {
      orderId: "ORD-RT-1025",
      customerName: "Koramangala Mart",
      destination: "80 Feet Rd, Koramangala",
      sequence: 2,
      status: "ASSIGNED",
      priority: "normal",
      windowStart: "10:00",
      windowEnd: "12:30",
      etaMin: 68,
      riskLevel: "low",
      riskScore: 0.18,
      driverUserId: params.actorUid,
      driverId: driverSelf.id,
      driverName: "Self (demo)",
      vehicleId: vehicleA.id,
      vehicleLabel: "KA-01-RT-101",
    },
    {
      orderId: "ORD-RT-1026",
      customerName: "HSR Foods",
      destination: "27th Main, HSR Layout",
      sequence: 3,
      status: "CREATED",
      priority: "critical",
      windowStart: "11:00",
      windowEnd: "13:00",
      etaMin: null,
      riskLevel: "high",
      riskScore: 0.72,
      driverUserId: params.altDriverUserId ?? null,
      driverId: driverAlt.id,
      driverName: "Arjun (demo)",
      vehicleId: vehicleB.id,
      vehicleLabel: "KA-01-RT-202",
    },
    {
      orderId: "ORD-RT-1027",
      customerName: "Jayanagar Pharmacy",
      destination: "4th Block, Jayanagar",
      sequence: 4,
      status: "EN_ROUTE",
      priority: "high",
      windowStart: "08:30",
      windowEnd: "10:00",
      etaMin: 18,
      riskLevel: "medium",
      riskScore: 0.55,
      driverUserId: params.actorUid,
      driverId: driverSelf.id,
      driverName: "Self (demo)",
      vehicleId: vehicleA.id,
      vehicleLabel: "KA-01-RT-101",
    },
  ];

  const deliveryIds: string[] = [];
  for (const d of deliveries) {
    const ref = await addDoc(collection(db, "deliveries"), {
      ...d,
      organizationId: org,
      routeId: "route-demo-1",
      exceptionOpen: false,
      synthetic: true,
      lastLocation: { lat: 12.97, lon: 77.59, synthetic: true },
      lastLocationAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    deliveryIds.push(ref.id);
  }

  await addDoc(collection(db, "auditLogs"), {
    organizationId: org,
    actorId: params.actorUid,
    actorEmail: params.actorEmail,
    actorUid: params.actorUid,
    action: "SEED_REALTIME_DEMO",
    eventType: "SEED_REALTIME_DEMO",
    entityType: "scenario",
    entityId: "realtime-demo",
    metadata: { deliveryCount: deliveryIds.length, synthetic: true },
    timestamp: serverTimestamp(),
    createdAt: serverTimestamp(),
  });

  return { deliveryIds, driverIds: [driverSelf.id, driverAlt.id] };
}
