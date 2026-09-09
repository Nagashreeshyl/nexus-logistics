# V2 Development Rules

## Hard rule

**Never modify the V1 baseline.**

- Tag `v1.0.0` is immutable.
- Do not force-move or delete `v1.0.0`.
- Do not rewrite V1 history to paper over V2 mistakes.

All V2 development occurs on branch:

```text
v2
```

## Working style

Never make one enormous uncommitted rewrite.

Work incrementally. After each major milestone:

1. Run tests (`backend` pytest).
2. Run frontend build (`npm run build`).
3. Run API health check.
4. Verify optimizer smoke / constraints.
5. Verify ML artifact loads (`/api/risk/metrics`).
6. Commit with a clear message.

If a milestone breaks the system: diagnose → fix → or revert the V2 commit. V1 remains untouched.

## Recommended milestone commits

| Milestone | Theme |
|-----------|--------|
| v2.1 | Firebase Auth |
| v2.2 | Firestore |
| v2.3 | RBAC |
| v2.4 | Realtime |
| v2.5 | Fleet / Drivers / Orders |
| v2.6 | Driver Dashboard |
| v2.7 | Delivery Execution |
| v2.8 | Exceptions / Reoptimization |
| v2.9 | Synthetic Data |
| v2.10 | Analytics |
| v2.11 | Testing |
| v2.12 | Presentation Polish |

Do not squash away milestone history unnecessarily.

## Branch model

```text
main          ← stable V1 tip (matches v1.0.0 at freeze)
└── v1.0.0    ← tagged snapshot
└── v2        ← future V2 development (starts from V1)
```

## Do not start V2 features until explicitly instructed

This document is process only. Firebase, Firestore, RBAC, realtime, driver UI, etc. must not begin until the owner confirms the V1 freeze succeeded.
