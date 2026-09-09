import pytest


@pytest.fixture(autouse=True)
def _force_haversine(monkeypatch):
    monkeypatch.setenv("JP019_TRAVEL", "haversine")
