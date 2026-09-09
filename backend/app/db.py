"""SQLite system of record for scenarios, orders, vehicles, holds, solve history."""

from __future__ import annotations

import csv
import json
import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

from .models import Order, Scenario, Vehicle

# Packaged seed CSVs / ML assets (read-only on serverless).
SEED_DIR = Path(__file__).resolve().parents[1] / "data"
# Writable DB dir — use /tmp on Vercel (ephemeral but Lab-safe).
DATA_DIR = Path(os.environ.get("NEXUS_DATA_DIR", str(SEED_DIR)))
DB_PATH = DATA_DIR / "nexus.db"

SCENARIO_META = {
    "a": ("SYS.01", "Feasible_Day"),
    "b": ("SYS.02", "Overconstrained"),
}


def _connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def db() -> Iterator[sqlite3.Connection]:
    conn = _connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    with db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS scenarios (
              id TEXT PRIMARY KEY,
              code TEXT NOT NULL,
              name TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS vehicles (
              scenario_id TEXT NOT NULL,
              vehicle_id TEXT NOT NULL,
              capacity INTEGER NOT NULL,
              depot_lat REAL NOT NULL,
              depot_lon REAL NOT NULL,
              shift_start INTEGER NOT NULL,
              shift_end INTEGER NOT NULL,
              driver TEXT,
              plate TEXT,
              phone TEXT,
              rating REAL,
              depot_address TEXT,
              PRIMARY KEY (scenario_id, vehicle_id),
              FOREIGN KEY (scenario_id) REFERENCES scenarios(id)
            );
            CREATE TABLE IF NOT EXISTS orders (
              scenario_id TEXT NOT NULL,
              order_id TEXT NOT NULL,
              lat REAL NOT NULL,
              lon REAL NOT NULL,
              demand INTEGER NOT NULL,
              tw_start INTEGER NOT NULL,
              tw_end INTEGER NOT NULL,
              service_min INTEGER NOT NULL,
              priority TEXT NOT NULL,
              zone TEXT NOT NULL,
              zone_name TEXT,
              customer TEXT,
              address TEXT,
              pincode TEXT,
              phone TEXT,
              sku TEXT,
              cod_inr INTEGER DEFAULT 0,
              PRIMARY KEY (scenario_id, order_id),
              FOREIGN KEY (scenario_id) REFERENCES scenarios(id)
            );
            CREATE TABLE IF NOT EXISTS holds (
              scenario_id TEXT NOT NULL,
              order_id TEXT NOT NULL,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (scenario_id, order_id)
            );
            CREATE TABLE IF NOT EXISTS solve_runs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              scenario_id TEXT NOT NULL,
              mode TEXT NOT NULL,
              travel_source TEXT,
              metrics_json TEXT NOT NULL,
              payload_json TEXT NOT NULL,
              created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_orders_scenario ON orders(scenario_id);
            CREATE INDEX IF NOT EXISTS idx_solve_scenario ON solve_runs(scenario_id, mode);
            """
        )
        count = conn.execute("SELECT COUNT(*) AS c FROM scenarios").fetchone()["c"]
        if count == 0:
            _seed(conn)


def _g(row: dict, key: str, default: str = "") -> str:
    return (row.get(key) or default).strip()


def _seed(conn: sqlite3.Connection) -> None:
    for sid, (code, name) in SCENARIO_META.items():
        folder = SEED_DIR / f"scenario_{sid}"
        conn.execute("INSERT OR REPLACE INTO scenarios(id, code, name) VALUES (?,?,?)", (sid, code, name))
        with (folder / "vehicles.csv").open() as f:
            for r in csv.DictReader(f):
                conn.execute(
                    """
                    INSERT OR REPLACE INTO vehicles(
                      scenario_id, vehicle_id, capacity, depot_lat, depot_lon, shift_start, shift_end,
                      driver, plate, phone, rating, depot_address
                    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        sid,
                        r["vehicle_id"],
                        int(r["capacity"]),
                        float(r["depot_lat"]),
                        float(r["depot_lon"]),
                        int(r["shift_start"]),
                        int(r["shift_end"]),
                        _g(r, "driver"),
                        _g(r, "plate"),
                        _g(r, "phone"),
                        float(r["rating"]) if r.get("rating") else 0.0,
                        _g(r, "depot_address"),
                    ),
                )
        with (folder / "orders.csv").open() as f:
            for r in csv.DictReader(f):
                conn.execute(
                    """
                    INSERT OR REPLACE INTO orders(
                      scenario_id, order_id, lat, lon, demand, tw_start, tw_end, service_min, priority,
                      zone, zone_name, customer, address, pincode, phone, sku, cod_inr
                    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    """,
                    (
                        sid,
                        r["order_id"],
                        float(r["lat"]),
                        float(r["lon"]),
                        int(r["demand"]),
                        int(r["tw_start"]),
                        int(r["tw_end"]),
                        int(r["service_min"]),
                        r["priority"],
                        r["zone"],
                        _g(r, "zone_name"),
                        _g(r, "customer"),
                        _g(r, "address"),
                        _g(r, "pincode"),
                        _g(r, "phone"),
                        _g(r, "sku"),
                        int(r["cod_inr"]) if r.get("cod_inr") else 0,
                    ),
                )


def list_scenarios() -> list[Scenario]:
    ids = ["a", "b"]
    with db() as conn:
        if conn.execute("SELECT 1 FROM scenarios WHERE id='lab'").fetchone():
            ids.append("lab")
    return [load_scenario(s) for s in ids]


def replace_scenario(
    scenario: Scenario,
    *,
    code: str,
    name: str,
    depot_address: str = "",
) -> None:
    """Replace all rows for a scenario id (used for regenerating the Lab synthetic day)."""
    sid = scenario.id.lower()
    with db() as conn:
        conn.execute("DELETE FROM holds WHERE scenario_id=?", (sid,))
        conn.execute("DELETE FROM solve_runs WHERE scenario_id=?", (sid,))
        conn.execute("DELETE FROM orders WHERE scenario_id=?", (sid,))
        conn.execute("DELETE FROM vehicles WHERE scenario_id=?", (sid,))
        conn.execute(
            "INSERT OR REPLACE INTO scenarios(id, code, name) VALUES (?,?,?)",
            (sid, code, name),
        )
        for v in scenario.vehicles:
            conn.execute(
                """
                INSERT INTO vehicles(
                  scenario_id, vehicle_id, capacity, depot_lat, depot_lon, shift_start, shift_end,
                  driver, plate, phone, rating, depot_address
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    sid,
                    v.vehicle_id,
                    int(v.capacity),
                    float(v.depot_lat),
                    float(v.depot_lon),
                    int(v.shift_start),
                    int(v.shift_end),
                    v.driver or "",
                    v.plate or "",
                    v.phone or "",
                    float(v.rating or 0),
                    depot_address or v.depot_address or "",
                ),
            )
        for o in scenario.orders:
            conn.execute(
                """
                INSERT INTO orders(
                  scenario_id, order_id, lat, lon, demand, tw_start, tw_end, service_min, priority,
                  zone, zone_name, customer, address, pincode, phone, sku, cod_inr
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    sid,
                    o.order_id,
                    float(o.lat),
                    float(o.lon),
                    int(o.demand),
                    int(o.tw_start),
                    int(o.tw_end),
                    int(o.service_min),
                    o.priority,
                    o.zone or "",
                    o.zone_name or o.zone or "",
                    o.customer or "",
                    o.address or "",
                    o.pincode or "",
                    o.phone or "",
                    o.sku or "",
                    int(o.cod_inr or 0),
                ),
            )


def load_scenario(scenario_id: str) -> Scenario:
    key = scenario_id.lower()
    with db() as conn:
        meta = conn.execute("SELECT * FROM scenarios WHERE id=?", (key,)).fetchone()
        if not meta:
            raise KeyError(scenario_id)
        vehicles = [
            Vehicle(
                vehicle_id=r["vehicle_id"],
                capacity=r["capacity"],
                depot_lat=r["depot_lat"],
                depot_lon=r["depot_lon"],
                shift_start=r["shift_start"],
                shift_end=r["shift_end"],
                driver=r["driver"] or "",
                plate=r["plate"] or "",
                phone=r["phone"] or "",
                rating=float(r["rating"] or 0),
                depot_address=r["depot_address"] or "",
            )
            for r in conn.execute("SELECT * FROM vehicles WHERE scenario_id=? ORDER BY vehicle_id", (key,))
        ]
        orders = [
            Order(
                order_id=r["order_id"],
                lat=r["lat"],
                lon=r["lon"],
                demand=r["demand"],
                tw_start=r["tw_start"],
                tw_end=r["tw_end"],
                service_min=r["service_min"],
                priority=r["priority"],  # type: ignore[arg-type]
                zone=r["zone"],
                zone_name=r["zone_name"] or "",
                customer=r["customer"] or "",
                address=r["address"] or "",
                pincode=r["pincode"] or "",
                phone=r["phone"] or "",
                sku=r["sku"] or "",
                cod_inr=int(r["cod_inr"] or 0),
            )
            for r in conn.execute("SELECT * FROM orders WHERE scenario_id=? ORDER BY order_id", (key,))
        ]
    return Scenario(id=key, code=meta["code"], name=meta["name"], orders=orders, vehicles=vehicles)


def get_holds(scenario_id: str) -> list[str]:
    with db() as conn:
        rows = conn.execute(
            "SELECT order_id FROM holds WHERE scenario_id=? ORDER BY order_id",
            (scenario_id,),
        ).fetchall()
    return [r["order_id"] for r in rows]


def set_hold(scenario_id: str, order_id: str, held: bool) -> list[str]:
    with db() as conn:
        if held:
            conn.execute(
                "INSERT OR IGNORE INTO holds(scenario_id, order_id) VALUES (?,?)",
                (scenario_id, order_id),
            )
        else:
            conn.execute(
                "DELETE FROM holds WHERE scenario_id=? AND order_id=?",
                (scenario_id, order_id),
            )
    return get_holds(scenario_id)


def clear_holds(scenario_id: str) -> list[str]:
    with db() as conn:
        conn.execute("DELETE FROM holds WHERE scenario_id=?", (scenario_id,))
    return []


def save_solve(scenario_id: str, mode: str, travel_source: str, metrics: dict[str, Any], payload: dict[str, Any]) -> int:
    with db() as conn:
        cur = conn.execute(
            """
            INSERT INTO solve_runs(scenario_id, mode, travel_source, metrics_json, payload_json)
            VALUES (?,?,?,?,?)
            """,
            (scenario_id, mode, travel_source, json.dumps(metrics), json.dumps(payload)),
        )
        return int(cur.lastrowid)


def latest_solve(scenario_id: str, mode: str | None = None) -> dict[str, Any] | None:
    with db() as conn:
        if mode:
            row = conn.execute(
                """
                SELECT * FROM solve_runs
                WHERE scenario_id=? AND mode=?
                ORDER BY id DESC LIMIT 1
                """,
                (scenario_id, mode),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT * FROM solve_runs WHERE scenario_id=? ORDER BY id DESC LIMIT 1",
                (scenario_id,),
            ).fetchone()
    if not row:
        return None
    return {
        "id": row["id"],
        "scenario_id": row["scenario_id"],
        "mode": row["mode"],
        "travel_source": row["travel_source"],
        "metrics": json.loads(row["metrics_json"]),
        "payload": json.loads(row["payload_json"]),
        "created_at": row["created_at"],
    }


def db_stats() -> dict[str, Any]:
    with db() as conn:
        return {
            "path": str(DB_PATH),
            "scenarios": conn.execute("SELECT COUNT(*) c FROM scenarios").fetchone()["c"],
            "orders": conn.execute("SELECT COUNT(*) c FROM orders").fetchone()["c"],
            "vehicles": conn.execute("SELECT COUNT(*) c FROM vehicles").fetchone()["c"],
            "holds": conn.execute("SELECT COUNT(*) c FROM holds").fetchone()["c"],
            "solve_runs": conn.execute("SELECT COUNT(*) c FROM solve_runs").fetchone()["c"],
        }
