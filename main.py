"""
Vercel Python entrypoint for Nexus Logistics FastAPI (Lab + Ops APIs).
Hobby-friendly: no Fly / Docker required.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Ensure `import app.*` resolves (package lives under backend/).
_ROOT = Path(__file__).resolve().parent
_BACKEND = _ROOT / "backend"
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

# Serverless-friendly defaults (override in Vercel project env if needed).
os.environ.setdefault("JP019_TRAVEL", "haversine")
os.environ.setdefault("NEXUS_DATA_DIR", "/tmp/nexus-data")

from app.main import app  # noqa: E402

__all__ = ["app"]
