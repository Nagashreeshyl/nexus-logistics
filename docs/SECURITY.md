# Security — Nexus Logistics V2

## Principles

- **Authentication:** Firebase Auth (email/password). No demo bypass login.
- **Authorization:** Firestore `users/{uid}.roles[]` is authoritative. `activeRole` is presentation-only and never grants access.
- **Organization isolation:** Every operational document carries `organizationId`. Rules require `userDoc().organizationId == resource.data.organizationId`.
- **Driver scoping:** Drivers may read/update only deliveries (and related) where `driverUserId == request.auth.uid`.
- **Analyst:** Read-only for operational collections; no create/update via rules for fleet/orders/customers.
- **No privilege escalation:** Clients cannot change `roles`, `organizationId`, or `status` on their user profile.

## Surfaces

| Layer | Enforcement |
|-------|-------------|
| Frontend routes | `RequireAuth` / `RequireRole` (UX only) |
| Firestore | `firestore.rules` (authoritative for client writes) |
| Backend `/api/ops/*` | Firebase ID token + `roles[]` via `require_roles` |

## Collections (ops)

vehicles, drivers, customers, orders, deliveries, routes, exceptions, notifications, optimizationRuns, auditLogs, organizations, users.

## Synthetic data

Synthetic records set `synthetic: true` and `dataSource: "synthetic"`. They still obey the same rules and org isolation.

## Hardening checklist

- [ ] Rules deployed to the active Firebase project
- [ ] Demo passwords only in gitignored secrets
- [ ] Backend Admin credentials never committed
- [ ] CORS / API only accepts authenticated ops mutations for mutate endpoints
