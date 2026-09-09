# Versioning — JP-019 Nexus Logistics

## V1

**Stable JP-019 MVP.**

Known-good snapshot of the hackathon solution: FastAPI + React, OR-Tools CVRPTW, baseline comparison, late-risk ML (synthetic), deferred/holds, judge win sheet.

Frozen as Git tag **`v1.0.0`**.

**V1 must remain recoverable.** Do not move, delete, or rewrite the `v1.0.0` tag.

## V2

**Major architecture and product expansion** (Firebase Auth, Firestore, RBAC, realtime, driver workflows, analytics, etc.).

All V2 work happens on the **`v2`** branch starting from the V1 baseline commit.

## Recovery rule

If V2 breaks the product:

```bash
git switch main
git checkout v1.0.0
# or: git switch -c restore-v1 v1.0.0
```

Never modify the V1 baseline in place to “fix” V2. Fix V2 on `v2`, or revert V2 commits.
