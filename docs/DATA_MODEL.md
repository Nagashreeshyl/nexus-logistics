# Data Model — Nexus Logistics V2

**Branch:** `v2`  
**Sources:** `docs/FIRESTORE_SCHEMA.md`, `frontend/src/lib/opsTypes.ts`, `firestore.rules`, `entityCrud.ts`

Firestore is the operational system of record for V2. Lab/V1 may still use local SQLite for solver demos — that path is separate from live ops.

---

## 1. Tenancy

Every operational document carries:

```text
organizationId: string   # e.g. "nexus-demo"
```

Access requires the caller’s `users/{uid}.organizationId` to match.

---

## 2. Collections

### `organizations/{orgId}`

| Field | Notes |
|-------|-------|
| name | Display name |
| status | Org lifecycle |
| synthetic? | Demo flag |

### `users/{uid}`

| Field | Notes |
|-------|-------|
| email, displayName | Profile |
| **roles[]** | Authorization |
| **activeRole** | UX workspace only |
| organizationId | Tenancy |
| status | active / etc. |
| driverId? | Optional link to drivers doc |
| lastSeenAt | Presence hint (not live GPS) |

### `drivers/{id}`

| Field | Notes |
|-------|-------|
| name, phone, license* | Identity |
| userId? | Firebase UID for secure assignment |
| assignedVehicleId? | Fleet link |
| status | AVAILABLE / ASSIGNED / ON_ROUTE / … |
| shiftStart / shiftEnd | Soft planning inputs |
| currentLocation / lastLocation | May be synthetic |
| synthetic / dataSource | Demo provenance |

### `vehicles/{id}`

| Field | Notes |
|-------|-------|
| registrationNumber, type | Fleet identity |
| capacityKg / capacity | Hard capacity for OR-Tools |
| status | AVAILABLE / ASSIGNED / BREAKDOWN / … |
| assignedDriverId? | Link |
| currentLocation | Often synthetic for demos |
| synthetic / dataSource | Demo provenance |

### `customers/{id}`

Address, lat/lon, preferred windows, contact fields, `organizationId`, synthetic flags.

### `orders/{id}`

| Field | Notes |
|-------|-------|
| customerId, customerName | Customer link |
| latitude, longitude, destination | Delivery geo |
| demandKg, priority | Optimization inputs |
| timeWindowStart / End | Hard windows |
| status | CREATED / PLANNING / ASSIGNED / … |
| assignedDriver* / assignedVehicleId / deliveryId | Assignment links |
| riskLevel / riskScore | Advisory |
| synthetic / dataSource | Demo provenance |

### `deliveries/{id}`

| Field | Notes |
|-------|-------|
| orderId | Required logical link |
| driverUserId / driverId / driverName | Assignment |
| vehicleId | Fleet link |
| status | CREATED / ASSIGNED / EN_ROUTE / ARRIVED / DELIVERED / FAILED |
| sequence, routeId, stopId | Route execution |
| window*, etaMin, risk* | Ops display |
| startedAt / arrivedAt / deliveredAt | Timestamps |
| failReason? | Failure path |
| lastLocation* | May be synthetic |
| organizationId | Tenancy |

### `routes/{id}`, `stops/{id}`

Route/stop sequences for optimized plans; may include `driverUserId`, polyline (when available), metrics.

### `exceptions/{id}`

| Field | Notes |
|-------|-------|
| type | LATE_RISK, VEHICLE_BREAKDOWN, DELIVERY_FAILED, … |
| severity | low/medium/high/critical |
| status | open / acknowledged / resolved |
| deliveryId / orderId / driverId / vehicleId | Impact refs |
| message | Human-readable |

### `optimizationRuns/{id}`

Mode (`live`, `reoptimize-breakdown`, …), metrics, comparison, feasibility, explanations, org id.

### `auditLogs/{id}`

Actor, eventType/action, entityType/entityId, metadata, timestamps, organizationId. Append-oriented; updates/deletes denied in rules.

### `notifications/{id}`

userId, type, title, body, entity refs, read flag, organizationId. In-app only (FCM later).

### `scenarios/{id}`, `metrics/{id}`

Demo scenario metadata and derived aggregates.

---

## 3. Delivery state machine

Centralized in `frontend/src/lib/deliveryStatus.ts` (mirrored conceptually on backend):

```text
CREATED → ASSIGNED → EN_ROUTE → ARRIVED → DELIVERED
              ↘ FAILED ↗ (recovery to ASSIGNED only)
```

Invalid transitions must throw / be rejected. UI must not invent statuses.

---

## 4. Synthetic data

Demo scenario generation stamps:

```text
synthetic: true
dataSource: "synthetic"
```

Reset deletes **only** synthetic org-scoped docs. Real operational records must remain untouched.

---

## 5. Integrity expectations

Preferred invariants (not all enforced by database constraints):

- Delivery.orderId → existing order in same org
- Delivery.driverUserId → existing user/driver linkage when assigned
- Delivery.vehicleId → existing vehicle when set
- Order.customerId → existing customer when set
- No cross-org references
- Coordinates finite; windows parseable
- Status values from enums only

Automated orphan detection / repair is **not** production-complete; see readiness doc.

---

## 6. Lab data (non-Firestore)

V1 scenarios and SQLite history under `backend/data/` support the Optimizer Lab. Do not confuse lab scenario IDs with live Firestore ops documents.
