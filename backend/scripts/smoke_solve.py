from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.baseline import run_baseline  # noqa: E402
from app.data_loader import load_scenario  # noqa: E402
from app.optimizer import run_optimize  # noqa: E402
from app.risk import RiskModel  # noqa: E402


def main() -> None:
    risk = RiskModel()
    for sid in ("a", "b"):
        s = load_scenario(sid)
        base = risk.attach(run_baseline(s), s.orders, s.vehicles)
        opt = risk.attach(run_optimize(s), s.orders, s.vehicles)
        print(
            json.dumps(
                {
                    "scenario": sid,
                    "baseline": base.metrics.__dict__,
                    "optimize": opt.metrics.__dict__,
                    "partial": opt.partial,
                    "unassigned": [u.order_id for u in opt.unassigned],
                    "opt_feasible": opt.feasible,
                },
                indent=2,
            )
        )


if __name__ == "__main__":
    main()
