"""Train late-risk model with holdout metrics. Synthetic history only."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.risk import MODEL_DIR, MODEL_PATH, META_PATH, train_and_evaluate  # noqa: E402


def main() -> None:
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    meta = train_and_evaluate(persist=True)
    print(json.dumps(meta, indent=2))
    print(f"Wrote {MODEL_PATH}")
    print(f"Wrote {META_PATH}")


if __name__ == "__main__":
    main()
