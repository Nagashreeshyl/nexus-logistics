from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

from pydantic import BaseModel, Field

Priority = Literal["critical", "normal"]
SolveMode = Literal["baseline", "optimize"]


@dataclass
class Order:
    order_id: str
    lat: float
    lon: float
    demand: int
    tw_start: int
    tw_end: int
    service_min: int
    priority: Priority
    zone: str
    zone_name: str = ""
    customer: str = ""
    address: str = ""
    pincode: str = ""
    phone: str = ""
    sku: str = ""
    cod_inr: int = 0


@dataclass
class Vehicle:
    vehicle_id: str
    capacity: int
    depot_lat: float
    depot_lon: float
    shift_start: int
    shift_end: int
    driver: str = ""
    plate: str = ""
    phone: str = ""
    rating: float = 0.0
    depot_address: str = ""


@dataclass
class Scenario:
    id: str
    code: str
    name: str
    orders: list[Order]
    vehicles: list[Vehicle]


@dataclass
class StopRisk:
    p_late: float
    reasons: list[str]
    triage: str = "monitor"


@dataclass
class Stop:
    order_id: str
    seq: int
    eta_min: int
    tw_start: int
    tw_end: int
    late: bool
    breach: bool
    priority: Priority
    demand: int
    lat: float
    lon: float
    zone: str
    risk: StopRisk | None = None
    customer: str = ""
    address: str = ""
    sku: str = ""
    cod_inr: int = 0
    phone: str = ""
    zone_name: str = ""


@dataclass
class Route:
    vehicle_id: str
    load: int
    capacity: int
    polyline: list[tuple[float, float]]
    stops: list[Stop]
    shift_start: int
    shift_end: int
    capacity_breach: bool
    driver: str = ""
    plate: str = ""
    phone: str = ""
    rating: float = 0.0
    road_source: str = "haversine"


@dataclass
class UnassignedOrder:
    order_id: str
    priority: Priority
    demand: int
    tw_start: int
    tw_end: int
    lat: float
    lon: float
    zone: str
    customer: str = ""
    address: str = ""
    sku: str = ""
    phone: str = ""
    zone_name: str = ""
    cod_inr: int = 0


@dataclass
class ConstraintEvent:
    order_id: str
    reason: str


@dataclass
class Metrics:
    late_count: int
    distance_km: float
    time_min: int
    capacity_breaches: int
    tw_violations: int
    hard_breaches: int
    unassigned_count: int
    criticals_served: int
    avg_lateness_min: float = 0.0
    total_lateness_min: float = 0.0
    vehicles_used: int = 0
    capacity_utilization: float = 0.0


@dataclass
class Solution:
    scenario_id: str
    mode: SolveMode
    feasible: bool
    partial: bool
    metrics: Metrics
    routes: list[Route]
    unassigned: list[UnassignedOrder]
    constraint_log: list[ConstraintEvent] = field(default_factory=list)
    travel_source: str = "haversine"


class SolveRequest(BaseModel):
    scenario_id: str
    mode: SolveMode


class RiskOut(BaseModel):
    p_late: float
    reasons: list[str]
    triage: str = "monitor"


class StopOut(BaseModel):
    order_id: str
    seq: int
    eta_min: int
    tw_start: int
    tw_end: int
    late: bool
    breach: bool
    priority: str
    demand: int
    lat: float
    lon: float
    zone: str
    risk: RiskOut | None = None
    customer: str = ""
    address: str = ""
    sku: str = ""
    cod_inr: int = 0
    phone: str = ""
    zone_name: str = ""


class RouteOut(BaseModel):
    vehicle_id: str
    load: int
    capacity: int
    polyline: list[list[float]]
    stops: list[StopOut]
    shift_start: int
    shift_end: int
    capacity_breach: bool
    driver: str = ""
    plate: str = ""
    phone: str = ""
    rating: float = 0.0
    road_source: str = "haversine"


class UnassignedOut(BaseModel):
    order_id: str
    priority: str
    demand: int
    tw_start: int
    tw_end: int
    lat: float
    lon: float
    zone: str
    customer: str = ""
    address: str = ""
    sku: str = ""
    phone: str = ""
    zone_name: str = ""
    cod_inr: int = 0


class MetricsOut(BaseModel):
    late_count: int
    distance_km: float
    time_min: int
    capacity_breaches: int
    tw_violations: int
    hard_breaches: int
    unassigned_count: int
    criticals_served: int
    avg_lateness_min: float = 0.0
    total_lateness_min: float = 0.0
    vehicles_used: int = 0
    capacity_utilization: float = 0.0


class ConstraintOut(BaseModel):
    order_id: str
    reason: str


class SolutionOut(BaseModel):
    scenario_id: str
    mode: str
    feasible: bool
    partial: bool
    metrics: MetricsOut
    routes: list[RouteOut]
    unassigned: list[UnassignedOut]
    constraint_log: list[ConstraintOut] = Field(default_factory=list)
    travel_source: str = "haversine"
    weather: dict | None = None


class ScenarioMetaOut(BaseModel):
    id: str
    code: str
    name: str
    order_count: int
    vehicle_count: int


class OrderOut(BaseModel):
    order_id: str
    lat: float
    lon: float
    demand: int
    tw_start: int
    tw_end: int
    service_min: int
    priority: str
    zone: str
    zone_name: str = ""
    customer: str = ""
    address: str = ""
    pincode: str = ""
    phone: str = ""
    sku: str = ""
    cod_inr: int = 0


class VehicleOut(BaseModel):
    vehicle_id: str
    capacity: int
    depot_lat: float
    depot_lon: float
    shift_start: int
    shift_end: int
    driver: str = ""
    plate: str = ""
    phone: str = ""
    rating: float = 0.0
    depot_address: str = ""


class ScenarioDetailOut(BaseModel):
    id: str
    code: str
    name: str
    depot: list[float]
    depot_address: str = ""
    orders: list[OrderOut]
    vehicles: list[VehicleOut]
    held: list[str] = Field(default_factory=list)
    weather: dict | None = None
    depot_geo: dict | None = None


class HoldRequest(BaseModel):
    scenario_id: str
    order_id: str
    held: bool = True
