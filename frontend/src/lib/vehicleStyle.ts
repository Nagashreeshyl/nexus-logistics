/**
 * Deterministic vehicle visual identity for Lab map routes.
 * Same vehicle ID → same color + dash pattern for the session/scenario.
 */

export type DashPattern = number[] | undefined;

export interface VehicleVisual {
  color: string;
  dashArray: DashPattern;
  patternLabel: "solid" | "dashed" | "dotted" | "dash-dot";
  index: number;
}

const STYLES: Omit<VehicleVisual, "index">[] = [
  { color: "#0A0A0A", dashArray: undefined, patternLabel: "solid" },
  { color: "#E45B3A", dashArray: [12, 8], patternLabel: "dashed" },
  { color: "#2F6F8F", dashArray: [2, 7], patternLabel: "dotted" },
  { color: "#3D7A4A", dashArray: [12, 6, 2, 6], patternLabel: "dash-dot" },
  { color: "#8B5E3C", dashArray: [8, 4, 2, 4], patternLabel: "dash-dot" },
  { color: "#6B4C9A", dashArray: [14, 6], patternLabel: "dashed" },
  { color: "#1F7A6B", dashArray: [3, 6], patternLabel: "dotted" },
];

function indexFromId(vehicleId: string): number {
  const m = vehicleId.match(/(\d+)/);
  if (m) return (parseInt(m[1], 10) - 1 + STYLES.length * 10) % STYLES.length;
  let h = 0;
  for (let i = 0; i < vehicleId.length; i++) h = (h * 31 + vehicleId.charCodeAt(i)) >>> 0;
  return h % STYLES.length;
}

export function vehicleVisual(vehicleId: string): VehicleVisual {
  const index = indexFromId(vehicleId);
  return { ...STYLES[index], index };
}

export function vehicleColor(vehicleId: string): string {
  return vehicleVisual(vehicleId).color;
}

/** CSS border style hint for legend / cards */
export function patternCss(pattern: VehicleVisual["patternLabel"]): string {
  switch (pattern) {
    case "dashed":
      return "dashed";
    case "dotted":
      return "dotted";
    case "dash-dot":
      return "dashed";
    default:
      return "solid";
  }
}
