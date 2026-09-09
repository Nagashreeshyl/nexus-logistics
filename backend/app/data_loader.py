from __future__ import annotations

from . import db
from .models import Scenario


def load_scenario(scenario_id: str) -> Scenario:
    return db.load_scenario(scenario_id)


def list_scenarios() -> list[Scenario]:
    return db.list_scenarios()
