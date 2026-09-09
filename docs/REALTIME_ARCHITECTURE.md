# Realtime Architecture — Nexus Logistics V2.4

```text
Firebase Auth
      │
      ▼
User Identity (users/{uid}.roles[] authorize)
      │
      ▼
Firestore (organization-scoped docs)
      │
      ├── organizations / users / vehicles / drivers
      ├── orders / routes / deliveries / exceptions
      ├── notifications / auditLogs
      │
      ▼
Realtime listeners (onSnapshot)
      │
      ├── subscribeToDocument / subscribeToQuery / subscribeToCollection
      ├── useRealtimeUserProfile / useRealtimeDeliveries / …
      │
      ▼
Dispatcher board  ←→  Driver route  ←→  In-app notifications
```

## Source of truth

Firestore listeners are the source of truth for operational UI.

Correct mutation path:

```text
Button → Firestore write → onSnapshot → React state → UI
```

Never:

- `setInterval` polling for ops state
- local-only fake updates after a button click
- hardcoded metrics in dashboards

## Hooks

| Hook | Scope |
|------|--------|
| `useRealtimeUserProfile` | `users/{uid}` |
| `useRealtimeOrganization` | `organizations/{orgId}` |
| `useRealtimeDeliveries` | org `deliveries` |
| `useRealtimeDrivers` / `Vehicles` / `Orders` / `Routes` / `Exceptions` | org collections |
| `useRealtimeNotifications` | `notifications` where `userId == uid` |

All operational collection hooks filter by `organizationId`.

## Delivery state machine

`frontend/src/lib/deliveryStatus.ts` + `backend/app/delivery_status.py`

```text
CREATED → ASSIGNED → EN_ROUTE → ARRIVED → DELIVERED
                 ↘ FAILED ↗ (recovery: FAILED → ASSIGNED only)
```

## Live indicator

`LiveSyncBadge` shows **Live** only when listeners report success. Otherwise Syncing / Connection issue / Permission denied / Unable to synchronize.

Presence uses `lastSeenAt` labeled **Last active** (not claimed Online).

## Demo procedure

1. Sign in as a multi-role demo user.
2. Switch to **Dispatcher**.
3. Dev only: open **Realtime Test Console** → Seed synthetic deliveries.
4. Open a second tab → switch role to **Driver**.
5. Driver: Start → Arrived → Complete. Dispatcher board updates without refresh.
6. Dispatcher: reassign a delivery. Driver list updates without refresh.
7. Create exception from console. Dispatcher exceptions list updates.

## Emulator

```bash
cd frontend && npm run firebase:emulators
# frontend/.env.local
VITE_USE_FIREBASE_EMULATOR=true
```

## Security

Authorization: Firebase Auth + `roles[]` + Security Rules (+ FastAPI for API).  
Never trust `activeRole`, URL, or localStorage for permissions.
