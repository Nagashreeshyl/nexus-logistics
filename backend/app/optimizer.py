from __future__ import annotations

from ortools.constraint_solver import pywrapcp

from .distance import matrices
from .fallback import drop_penalty
from .metrics import simulate
from .models import ConstraintEvent, Scenario, Solution


def run_optimize(
    scenario: Scenario,
    time_limit_s: int = 8,
    triage_scores: dict[str, float] | None = None,
) -> Solution:
    """
    CVRPTW with hard capacity + hard time windows.
    Optional triage_scores (pre-routing late probability) slightly raise drop cost
    for high-risk normals so they are preferred when capacity allows — never relaxes constraints.
    """
    orders = scenario.orders
    vehicles = scenario.vehicles
    n_orders = len(orders)
    n_vehicles = len(vehicles)
    scores = triage_scores or {}
    if n_orders == 0:
        return simulate(scenario.id, "optimize", orders, vehicles, {v.vehicle_id: [] for v in vehicles}, [])

    _, min_mat, _src = matrices(orders, vehicles[0])
    manager = pywrapcp.RoutingIndexManager(n_orders + 1, n_vehicles, 0)
    routing = pywrapcp.RoutingModel(manager)

    def time_cb(from_index: int, to_index: int) -> int:
        frm = manager.IndexToNode(from_index)
        to = manager.IndexToNode(to_index)
        service = 0 if frm == 0 else orders[frm - 1].service_min
        return min_mat[frm][to] + service

    def demand_cb(from_index: int) -> int:
        node = manager.IndexToNode(from_index)
        return 0 if node == 0 else orders[node - 1].demand

    time_idx = routing.RegisterTransitCallback(time_cb)
    routing.SetArcCostEvaluatorOfAllVehicles(time_idx)
    demand_idx = routing.RegisterUnaryTransitCallback(demand_cb)

    routing.AddDimensionWithVehicleCapacity(
        demand_idx,
        0,
        [v.capacity for v in vehicles],
        True,
        "Capacity",
    )

    max_horizon = max(v.shift_end for v in vehicles) + 60
    routing.AddDimension(time_idx, max_horizon, max_horizon, False, "Time")
    time_dim = routing.GetDimensionOrDie("Time")

    for v, vehicle in enumerate(vehicles):
        start = routing.Start(v)
        end = routing.End(v)
        time_dim.CumulVar(start).SetRange(vehicle.shift_start, vehicle.shift_end)
        time_dim.CumulVar(end).SetRange(vehicle.shift_start, vehicle.shift_end)

    for i, order in enumerate(orders):
        index = manager.NodeToIndex(i + 1)
        time_dim.CumulVar(index).SetRange(order.tw_start, order.tw_end)
        # Soft triage: bump normal drop penalty by up to ~25% of normal base; criticals stay dominant
        p = float(scores.get(order.order_id, 0.0))
        risk_bump = int(min(max(p, 0.0), 1.0) * 2000) if order.priority != "critical" else 0
        routing.AddDisjunction([index], drop_penalty(order.priority) + risk_bump)

    params = pywrapcp.DefaultRoutingSearchParameters()
    # PATH_CHEAPEST_ARC=3, GUIDED_LOCAL_SEARCH=2 (ortools 9.11 nested enums)
    params.first_solution_strategy = 3
    params.local_search_metaheuristic = 2
    params.time_limit.FromSeconds(time_limit_s)

    try:
        solution = routing.SolveWithParameters(params)
    except Exception:
        # OR-Tools can raise (e.g. "CP Solver fail") on rare model/search faults —
        # treat as hard infeasibility instead of 500'ing the Lab.
        solution = None

    assignments: dict[str, list[str]] = {v.vehicle_id: [] for v in vehicles}
    served: set[str] = set()
    log: list[ConstraintEvent] = []

    if solution is None:
        dropped = [o.order_id for o in orders]
        log = [ConstraintEvent(order_id=oid, reason="infeasible_under_hard_constraints") for oid in dropped]
        return simulate(scenario.id, "optimize", orders, vehicles, assignments, dropped, log)

    for v, vehicle in enumerate(vehicles):
        index = routing.Start(v)
        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            if node > 0:
                oid = orders[node - 1].order_id
                assignments[vehicle.vehicle_id].append(oid)
                served.add(oid)
            index = solution.Value(routing.NextVar(index))

    dropped = [o.order_id for o in orders if o.order_id not in served]
    for oid in dropped:
        o = next(x for x in orders if x.order_id == oid)
        reason = "infeasible_under_hard_constraints"
        if o.priority == "normal" and scores.get(oid, 0) >= 0.55:
            reason = "deferred_capacity_or_window_high_late_risk"
        elif o.priority == "normal":
            reason = "deferred_capacity_or_window"
        log.append(ConstraintEvent(order_id=oid, reason=reason))
    return simulate(scenario.id, "optimize", orders, vehicles, assignments, dropped, log)
