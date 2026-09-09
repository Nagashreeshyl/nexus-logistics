/**
 * Pure delivery state-machine checks — run: npx --yes tsx src/lib/deliveryStatus.selftest.ts
 */
import { assertTransition, canTransition, nextPrimaryTransition } from "./deliveryStatus";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(canTransition("CREATED", "ASSIGNED"), "CREATED→ASSIGNED");
assert(canTransition("ASSIGNED", "EN_ROUTE"), "ASSIGNED→EN_ROUTE");
assert(canTransition("EN_ROUTE", "ARRIVED"), "EN_ROUTE→ARRIVED");
assert(canTransition("ARRIVED", "DELIVERED"), "ARRIVED→DELIVERED");
assert(canTransition("ASSIGNED", "FAILED"), "ASSIGNED→FAILED");
assert(canTransition("FAILED", "ASSIGNED"), "FAILED recovery");

assert(!canTransition("CREATED", "DELIVERED"), "block CREATED→DELIVERED");
assert(!canTransition("DELIVERED", "EN_ROUTE"), "block DELIVERED→EN_ROUTE");
assert(!canTransition("FAILED", "DELIVERED"), "block FAILED→DELIVERED");
assert(!canTransition("EN_ROUTE", "ASSIGNED"), "block EN_ROUTE→ASSIGNED");

assert(nextPrimaryTransition("ASSIGNED") === "EN_ROUTE", "primary ASSIGNED");
assert(nextPrimaryTransition("DELIVERED") === null, "no primary when done");

let threw = false;
try {
  assertTransition("CREATED", "DELIVERED");
} catch {
  threw = true;
}
assert(threw, "assertTransition throws");

console.log("deliveryStatus.selftest OK");
