from __future__ import annotations

from .distance import matrices
from .metrics import simulate
from .models import Order, Scenario, Solution, Vehicle


def _nn_sequence(order_ids: list[str], orders: list[Order], vehicle: Vehicle) -> list[str]:
    if not order_ids:
        return []
    index_of = {o.order_id: i + 1 for i, o in enumerate(orders)}
    _, min_mat, _src = matrices(orders, vehicle)
    remaining = set(order_ids)
    seq: list[str] = []
    prev = 0
    while remaining:
        nxt = min(remaining, key=lambda oid: min_mat[prev][index_of[oid]])
        seq.append(nxt)
        remaining.remove(nxt)
        prev = index_of[nxt]
    return seq


def run_baseline(scenario: Scenario) -> Solution:
    orders = scenario.orders
    vehicles = scenario.vehicles
    ranked = sorted(
        orders,
        key=lambda o: (0 if o.priority == "critical" else 1, o.tw_end, o.order_id),
    )
    remaining_cap = {v.vehicle_id: v.capacity for v in vehicles}
    buckets: dict[str, list[str]] = {v.vehicle_id: [] for v in vehicles}

    for o in ranked:
        fit = next((v for v in vehicles if remaining_cap[v.vehicle_id] >= o.demand), None)
        if fit is None:
            fit = max(vehicles, key=lambda v: remaining_cap[v.vehicle_id])
        buckets[fit.vehicle_id].append(o.order_id)
        remaining_cap[fit.vehicle_id] -= o.demand

    assignments = {
        v.vehicle_id: _nn_sequence(buckets[v.vehicle_id], orders, v) for v in vehicles
    }
    assigned = {oid for seq in assignments.values() for oid in seq}
    dropped = [o.order_id for o in orders if o.order_id not in assigned]
    return simulate(scenario.id, "baseline", orders, vehicles, assignments, dropped)
