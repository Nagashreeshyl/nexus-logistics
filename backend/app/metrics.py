from __future__ import annotations

from . import osrm_client
from .distance import matrices
from .models import (
    ConstraintEvent,
    Metrics,
    Order,
    Route,
    Solution,
    Stop,
    UnassignedOrder,
    Vehicle,
)


def simulate(
    scenario_id: str,
    mode: str,
    orders: list[Order],
    vehicles: list[Vehicle],
    assignments: dict[str, list[str]],
    dropped: list[str],
    constraint_log: list[ConstraintEvent] | None = None,
) -> Solution:
    by_id = {o.order_id: o for o in orders}
    km_mat, min_mat, travel_source = matrices(orders, vehicles[0])
    index_of = {o.order_id: i + 1 for i, o in enumerate(orders)}

    routes: list[Route] = []
    distance_km = 0.0
    time_min = 0
    late_count = 0
    tw_violations = 0
    capacity_breaches = 0
    criticals = 0
    lateness_vals: list[float] = []
    assigned: set[str] = set()

    for v in vehicles:
        seq_ids = assignments.get(v.vehicle_id, [])
        stops: list[Stop] = []
        polyline: list[tuple[float, float]] = [(v.depot_lat, v.depot_lon)]
        load = 0
        t = v.shift_start
        prev = 0
        for seq, oid in enumerate(seq_ids, start=1):
            o = by_id[oid]
            assigned.add(oid)
            node = index_of[oid]
            travel = min_mat[prev][node]
            t += travel
            time_min += travel
            distance_km += km_mat[prev][node]
            arrival = t
            if arrival < o.tw_start:
                t = o.tw_start
            late = arrival > o.tw_end
            window_breach = late or (arrival > v.shift_end)
            lateness = max(0.0, float(arrival - o.tw_end))
            if late:
                lateness_vals.append(lateness)
            t += o.service_min
            load += o.demand
            if o.priority == "critical":
                criticals += 1
            if late:
                late_count += 1
            if window_breach:
                tw_violations += 1
            polyline.append((o.lat, o.lon))
            stops.append(
                Stop(
                    order_id=o.order_id,
                    seq=seq,
                    eta_min=int(arrival),
                    tw_start=o.tw_start,
                    tw_end=o.tw_end,
                    late=late,
                    breach=window_breach,
                    priority=o.priority,
                    demand=o.demand,
                    lat=o.lat,
                    lon=o.lon,
                    zone=o.zone,
                    customer=o.customer,
                    address=o.address,
                    sku=o.sku,
                    cod_inr=o.cod_inr,
                    phone=o.phone,
                    zone_name=o.zone_name,
                )
            )
            prev = node
        if seq_ids:
            travel_home = min_mat[prev][0]
            time_min += travel_home
            distance_km += km_mat[prev][0]
            polyline.append((v.depot_lat, v.depot_lon))
        cap_breach = load > v.capacity
        if cap_breach:
            capacity_breaches += 1
            for s in stops:
                s.breach = True
        routes.append(
            Route(
                vehicle_id=v.vehicle_id,
                load=load,
                capacity=v.capacity,
                polyline=polyline,
                stops=stops,
                shift_start=v.shift_start,
                shift_end=v.shift_end,
                capacity_breach=cap_breach,
                driver=v.driver,
                plate=v.plate,
                phone=v.phone,
                rating=v.rating,
                road_source=travel_source,
            )
        )

    dropped_set = set(dropped) | ({o.order_id for o in orders} - assigned)
    unassigned: list[UnassignedOrder] = []
    for oid in dropped_set:
        o = by_id[oid]
        unassigned.append(
            UnassignedOrder(
                order_id=o.order_id,
                priority=o.priority,
                demand=o.demand,
                tw_start=o.tw_start,
                tw_end=o.tw_end,
                lat=o.lat,
                lon=o.lon,
                zone=o.zone,
                customer=o.customer,
                address=o.address,
                sku=o.sku,
                phone=o.phone,
                zone_name=o.zone_name,
                cod_inr=o.cod_inr,
            )
        )
    unassigned.sort(key=lambda u: (0 if u.priority == "critical" else 1, u.tw_end, u.order_id))

    hard = capacity_breaches + tw_violations
    used_routes = [r for r in routes if r.stops]
    vehicles_used = len(used_routes)
    util = 0.0
    if used_routes:
        util = round(
            sum(r.load / max(r.capacity, 1) for r in used_routes) / len(used_routes),
            3,
        )
    total_lateness = round(sum(lateness_vals), 2)
    avg_lateness = round(total_lateness / len(lateness_vals), 2) if lateness_vals else 0.0
    metrics = Metrics(
        late_count=late_count,
        distance_km=round(distance_km, 2),
        time_min=int(round(time_min)),
        capacity_breaches=capacity_breaches,
        tw_violations=tw_violations,
        hard_breaches=hard,
        unassigned_count=len(unassigned),
        criticals_served=criticals,
        avg_lateness_min=avg_lateness,
        total_lateness_min=total_lateness,
        vehicles_used=vehicles_used,
        capacity_utilization=util,
    )
    return Solution(
        scenario_id=scenario_id,
        mode=mode,  # type: ignore[arg-type]
        feasible=hard == 0,
        partial=len(unassigned) > 0,
        metrics=metrics,
        routes=routes,
        unassigned=unassigned,
        constraint_log=constraint_log or [],
        travel_source=travel_source,
    )


def snap_roads(solution: Solution) -> Solution:
    """Optionally snap polylines to OSRM. Never rewrite matrix travel_source labels."""
    from .distance import force_haversine

    if force_haversine():
        # Demo/offline: skip public OSRM route calls; keep straight-line polylines.
        return solution

    matrix_source = solution.travel_source
    for route in solution.routes:
        if len(route.polyline) < 2:
            continue
        road = osrm_client.route_polyline(route.polyline)
        if road:
            route.polyline = road
            route.road_source = "osrm"
        else:
            route.road_source = matrix_source
    # Matrix source remains the authority for distance/time travel labels.
    solution.travel_source = matrix_source
    return solution
