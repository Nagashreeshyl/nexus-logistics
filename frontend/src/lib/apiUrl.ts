/**
 * API origin for Vite builds.
 * - Local dev: leave empty and use Vite proxy (`/api` → :8000), or set VITE_API_BASE_URL.
 * - Vercel: set VITE_API_BASE_URL to a publicly reachable FastAPI host (not localhost).
 */
export function apiUrl(path: string): string {
  const base = String(import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
