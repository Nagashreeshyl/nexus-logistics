# Firestore Schema — Nexus Logistics V2

Organization-scoped collections (field `organizationId` on every operational doc).

## organizations/{orgId}
name, status, synthetic?, createdAt, updatedAt

## users/{uid}
email, displayName, roles[], activeRole, driverId?, organizationId, status, demoMultiRole?, createdAt, updatedAt

## drivers/{id}
name, employeeId, phone, assignedVehicleId?, shiftStart, shiftEnd, zone, status, performance?, currentRouteId?, userId?, synthetic?, organizationId, createdAt, updatedAt, createdBy

## vehicles/{id}
registrationNumber, type, capacity, maxRouteDuration, startLocation{lat,lon,address}, endLocation{}, availability, status, assignedDriverId?, currentRouteId?, utilization?, synthetic?, organizationId, …

## customers/{id}
name, type, address, latitude, longitude, phone, preferredDeliveryInfo?, synthetic?, organizationId, …

## orders/{id}
customerId, address, latitude, longitude, demand, volume?, priority, windowStart, windowEnd, serviceTime, deadline?, status, assignedVehicleId?, assignedDriverId?, assignedDriverUserId?, riskScore?, riskLevel?, riskReasons[], synthetic?, organizationId, …

## routes/{id}
vehicleId, driverId, driverUserId?, planId?, stopIds[], status, polyline?, distanceKm?, timeMin?, organizationId, …

## stops/{id}
routeId, orderId, seq, etaMin?, status, organizationId, …

## deliveries/{id}
orderId, routeId, stopId, driverUserId, status, startedAt?, arrivedAt?, deliveredAt?, failReason?, organizationId, …

## exceptions/{id}
type, severity, status, orderId?, vehicleId?, driverId?, message, explanation, recommendedAction, organizationId, …

## optimizationRuns/{id}
mode (baseline|optimize), metrics{}, comparison?, inputSnapshot?, organizationId, …

## auditLogs/{id}
actorId, actorEmail, action, entityType, entityId, metadata, timestamp, organizationId

## scenarios/{id}
name, counts{}, synthetic: true, organizationId, …

## metrics/{id}
derived operational aggregates — written by services, never hardcoded in UI

Timestamps: Firestore Timestamp / UTC datetime via Admin SDK.
