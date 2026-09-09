export function fmtClock(minFromEight: number): string {
  const total = 8 * 60 + minFromEight;
  const h = Math.floor(total / 60) % 24;
  const m = ((total % 60) + 60) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function deltaClass(value: number, invertWin = true): string {
  if (value === 0) return "text-mute";
  const win = invertWin ? value < 0 : value > 0;
  return win ? "text-ink" : "text-coral";
}

export function formatDelta(value: number, digits = 0): string {
  const abs = digits ? Math.abs(value).toFixed(digits) : String(Math.abs(Math.round(value)));
  if (value === 0) return "0";
  return `${value > 0 ? "+" : "−"}${abs}`;
}

export function inr(n: number): string {
  return n <= 0 ? "Prepaid" : `₹${n.toLocaleString("en-IN")}`;
}
