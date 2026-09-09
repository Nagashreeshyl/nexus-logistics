import { collection, getDocs, query, where } from "firebase/firestore";
import { getFirebase } from "../../firebase/config";

function dbOrThrow() {
  const fb = getFirebase();
  if (!fb.configured) throw new Error(fb.reason);
  return fb.db;
}

async function listOrgCollection(name: string, organizationId: string) {
  const q = query(collection(dbOrThrow(), name), where("organizationId", "==", organizationId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** Scaffold — later milestones expand filters (driver assignment, status). */
export async function getDrivers(organizationId: string) {
  return listOrgCollection("drivers", organizationId);
}

export async function getVehicles(organizationId: string) {
  return listOrgCollection("vehicles", organizationId);
}

export async function getOrders(organizationId: string) {
  return listOrgCollection("orders", organizationId);
}
