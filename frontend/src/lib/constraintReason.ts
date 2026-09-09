/** Human-readable labels for OR-Tools / fallback constraint reason codes. */
const REASON_LABELS: Record<string, string> = {
  deferred_capacity_or_window: "Could not fit under capacity or time window",
  deferred_capacity_or_window_high_late_risk: "Deferred — capacity/window pressure (elevated late risk)",
  infeasible_under_hard_constraints: "Infeasible under hard capacity/window rules",
  capacity_exceeded: "Would exceed van capacity",
  time_window_missed: "Would miss delivery time window",
  dropped: "Deferred by solver",
};

export function formatConstraintReason(raw: string | undefined | null): string {
  if (!raw) return "";
  if (REASON_LABELS[raw]) return REASON_LABELS[raw];
  // snake_case → readable sentence
  const spaced = raw.replace(/_/g, " ").trim();
  if (!spaced) return raw;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
