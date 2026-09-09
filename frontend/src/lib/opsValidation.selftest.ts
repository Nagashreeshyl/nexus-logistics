/**
 * Pure ops validation — npm run test:ops
 */
import { validateOrderInput, validateVehicleInput, ValidationError } from "./opsValidation";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

validateVehicleInput({
  registrationNumber: "KA-01-V-100",
  vehicleType: "VAN",
  capacityKg: 800,
  volumeCapacity: 4,
  status: "AVAILABLE",
});

let threw = false;
try {
  validateVehicleInput({
    registrationNumber: "X",
    vehicleType: "SPACESHIP" as "VAN",
    capacityKg: 1,
    volumeCapacity: 0,
    status: "AVAILABLE",
  });
} catch (e) {
  threw = e instanceof ValidationError;
}
assert(threw, "invalid vehicle type");

threw = false;
try {
  validateOrderInput({
    customerId: "c1",
    customerName: "A",
    destination: "Addr",
    latitude: 12.9,
    longitude: 77.6,
    demandKg: 0,
    volume: 0,
    priority: "HIGH",
    timeWindowStart: "09:00",
    timeWindowEnd: "11:00",
    serviceDurationMinutes: 10,
    requestedDate: "2026-09-09",
  });
} catch (e) {
  threw = e instanceof ValidationError;
}
assert(threw, "demandKg must be > 0");

console.log("opsValidation.selftest OK");
