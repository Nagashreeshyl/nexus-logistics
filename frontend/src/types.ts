export type Priority = "critical" | "normal";
export type SolveMode = "baseline" | "optimize";

export interface Risk {
  p_late: number;
  reasons: string[];
  triage?: string;
}

export interface Weather {
  ok: boolean;
  source: string;
  label: string;
  temp_c: number | null;
  precip_mm: number;
  humidity: number | null;
  wind_kmh: number | null;
  wet: boolean;
  risk_note: string;
  time?: string;
}

export interface Stop {
  order_id: string;
  seq: number;
  eta_min: number;
  tw_start: number;
  tw_end: number;
  late: boolean;
  breach: boolean;
  priority: Priority;
  demand: number;
  lat: number;
  lon: number;
  zone: string;
  risk: Risk | null;
  customer: string;
  address: string;
  sku: string;
  cod_inr: number;
  phone: string;
  zone_name: string;
}

export interface RoutePlan {
  vehicle_id: string;
  load: number;
  capacity: number;
  polyline: number[][];
  stops: Stop[];
  shift_start: number;
  shift_end: number;
  capacity_breach: boolean;
  driver: string;
  plate: string;
  phone: string;
  rating: number;
  road_source: string;
}

export interface Unassigned {
  order_id: string;
  priority: Priority;
  demand: number;
  tw_start: number;
  tw_end: number;
  lat: number;
  lon: number;
  zone: string;
  customer: string;
  address: string;
  sku: string;
  phone: string;
  zone_name: string;
  cod_inr: number;
}

export interface Metrics {
  late_count: number;
  distance_km: number;
  time_min: number;
  capacity_breaches: number;
  tw_violations: number;
  hard_breaches: number;
  unassigned_count: number;
  criticals_served: number;
  avg_lateness_min?: number;
  total_lateness_min?: number;
  vehicles_used?: number;
  capacity_utilization?: number;
}

export interface ConstraintEvent {
  order_id: string;
  reason: string;
}

export interface Solution {
  scenario_id: string;
  mode: SolveMode;
  feasible: boolean;
  partial: boolean;
  metrics: Metrics;
  routes: RoutePlan[];
  unassigned: Unassigned[];
  constraint_log: ConstraintEvent[];
  travel_source: string;
  weather: Weather | null;
}

export interface Order {
  order_id: string;
  lat: number;
  lon: number;
  demand: number;
  tw_start: number;
  tw_end: number;
  service_min: number;
  priority: Priority;
  zone: string;
  zone_name: string;
  customer: string;
  address: string;
  pincode: string;
  phone: string;
  sku: string;
  cod_inr: number;
}

export interface Vehicle {
  vehicle_id: string;
  capacity: number;
  depot_lat: number;
  depot_lon: number;
  shift_start: number;
  shift_end: number;
  driver: string;
  plate: string;
  phone: string;
  rating: number;
  depot_address: string;
}

export interface ScenarioDetail {
  id: string;
  code: string;
  name: string;
  depot: number[];
  depot_address: string;
  orders: Order[];
  vehicles: Vehicle[];
  held: string[];
  weather: Weather | null;
  depot_geo?: {
    ok: boolean;
    display_name: string;
    suburb?: string;
    city?: string;
    postcode?: string;
  } | null;
}

export const VEHICLE_COLORS: Record<string, string> = {
  "VAN-1": "#0A0A0A",
  "VAN-2": "#F47C59",
  "VAN-3": "#3B82A8",
  V01: "#0A0A0A",
  V02: "#F47C59",
  V03: "#3B82A8",
  V04: "#92CFF2",
  V05: "#E8A87C",
  V06: "#C38D9E",
  V07: "#41B3A3",
};
