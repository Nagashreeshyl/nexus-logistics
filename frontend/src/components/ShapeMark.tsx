import type { SVGProps } from "react";

type ShapeName =
  | "mark"
  | "topo"
  | "logic"
  | "stop-critical"
  | "stop-normal"
  | "depot"
  | "route-optimized"
  | "exception"
  | "mesh-a"
  | "mesh-b"
  | "chip-a"
  | "chip-b"
  | "arrow";

interface ShapeMarkProps extends SVGProps<SVGSVGElement> {
  name: ShapeName;
}

export function ShapeMark({ name, className, ...rest }: ShapeMarkProps) {
  const common = { className, ...rest };
  switch (name) {
    case "topo":
      return (
        <svg viewBox="0 0 240 240" fill="none" aria-hidden {...common}>
          <line x1="24" y1="24" x2="216" y2="216" stroke="#0A0A0A" strokeWidth="1" opacity="0.35" />
          <line x1="216" y1="24" x2="24" y2="216" stroke="#0A0A0A" strokeWidth="1" opacity="0.35" />
          <rect x="58" y="58" width="124" height="124" stroke="#0A0A0A" strokeWidth="10" />
          <path d="M120 54 L186 120 L120 186 L54 120 Z" fill="#0A0A0A" />
          <circle cx="120" cy="120" r="34" fill="#F47C59" stroke="#0A0A0A" strokeWidth="6" />
          <circle cx="54" cy="120" r="3.5" fill="#fff" stroke="#0A0A0A" strokeWidth="1.5" />
          <circle cx="186" cy="120" r="3.5" fill="#fff" stroke="#0A0A0A" strokeWidth="1.5" />
          <circle cx="120" cy="54" r="3.5" fill="#fff" stroke="#0A0A0A" strokeWidth="1.5" />
          <circle cx="120" cy="186" r="3.5" fill="#fff" stroke="#0A0A0A" strokeWidth="1.5" />
        </svg>
      );
    case "logic":
      return (
        <svg viewBox="0 0 240 240" fill="none" aria-hidden {...common}>
          <circle cx="120" cy="120" r="88" fill="#0A0A0A" />
          <rect x="72" y="72" width="96" height="96" fill="#92CFF2" />
          <path d="M120 78 L162 120 L120 162 L78 120 Z" fill="#0A0A0A" />
          <path d="M120 104 V136 M104 120 H136" stroke="#fff" strokeWidth="4" strokeLinecap="square" />
          <circle cx="72" cy="72" r="3.5" fill="#0A0A0A" />
          <circle cx="168" cy="72" r="3.5" fill="#0A0A0A" />
          <circle cx="72" cy="168" r="3.5" fill="#0A0A0A" />
          <circle cx="168" cy="168" r="3.5" fill="#0A0A0A" />
        </svg>
      );
    case "arrow":
      return (
        <svg viewBox="0 0 32 16" fill="none" aria-hidden {...common}>
          <path d="M2 8 H26 M20 2 L28 8 L20 14" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case "mark":
      return (
        <svg viewBox="0 0 64 64" fill="none" aria-hidden {...common}>
          <path fill="currentColor" d="M32 2 40.6 23.4 62 32 40.6 40.6 32 62 23.4 40.6 2 32 23.4 23.4Z" />
        </svg>
      );
    case "stop-critical":
      return (
        <svg viewBox="0 0 64 64" fill="none" aria-hidden {...common}>
          <path fill="currentColor" d="M32 4 38.2 24.8 60 32 38.2 39.2 32 60 25.8 39.2 4 32 25.8 24.8Z" />
        </svg>
      );
    case "stop-normal":
      return (
        <svg viewBox="0 0 64 64" fill="none" aria-hidden {...common}>
          <circle cx="32" cy="32" r="14" stroke="currentColor" strokeWidth="5" />
          <circle cx="32" cy="32" r="5" fill="currentColor" />
        </svg>
      );
    case "depot":
      return (
        <svg viewBox="0 0 64 64" fill="none" aria-hidden {...common}>
          <path
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M32 10v44M18 24 32 10l14 14M18 40l14 14 14-14"
          />
        </svg>
      );
    case "route-optimized":
      return (
        <svg viewBox="0 0 64 64" fill="none" aria-hidden {...common}>
          <path stroke="currentColor" strokeWidth="5" strokeLinecap="round" d="M12 40c8-18 14-18 20 0 6 18 12 18 20 0" />
          <path stroke="currentColor" strokeWidth="5" strokeLinecap="round" d="M12 24c8 18 14 18 20 0 6-18 12-18 20 0" />
        </svg>
      );
    case "exception":
      return (
        <svg viewBox="0 0 64 64" fill="none" aria-hidden {...common}>
          <path stroke="currentColor" strokeWidth="6" strokeLinecap="round" d="M16 16 48 48M48 16 16 48" />
        </svg>
      );
    case "mesh-a":
      return (
        <svg viewBox="0 0 200 200" fill="none" aria-hidden {...common}>
          <path fill="currentColor" d="M100 8c28 22 62 18 84 42-24 26-18 62-42 84-22-28-62-18-84-42 24-26 18-62 42-84Z" />
        </svg>
      );
    case "mesh-b":
      return (
        <svg viewBox="0 0 200 200" fill="none" aria-hidden {...common}>
          <path fill="currentColor" d="M20 70c40-50 90-40 120-10 20 40-10 90-50 110-50 10-90-30-70-100Z" />
        </svg>
      );
    case "chip-a":
      return (
        <svg viewBox="0 0 32 32" fill="none" aria-hidden {...common}>
          <rect x="4" y="4" width="10" height="10" fill="currentColor" />
          <rect x="18" y="18" width="10" height="10" fill="currentColor" />
        </svg>
      );
    case "chip-b":
      return (
        <svg viewBox="0 0 32 32" fill="none" aria-hidden {...common}>
          <path fill="currentColor" d="M16 3 29 16 16 29 3 16Z" />
        </svg>
      );
  }
}
