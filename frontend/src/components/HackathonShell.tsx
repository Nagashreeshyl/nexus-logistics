import { NavLink, Outlet } from "react-router-dom";
import { BrandLogo } from "./BrandLogo";

/**
 * Shared light chrome — matches V1 Optimizer Lab (paper / snow / ink / coral).
 */
export function HackathonShell() {
  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink">
      <header className="flex items-center justify-between gap-4 border-b border-hairline bg-snow px-5 py-4 md:px-8">
        <NavLink to="/" className="flex items-center gap-3 no-underline">
          <BrandLogo className="h-7 w-7" />
          <div>
            <p className="font-sans text-[15px] font-semibold tracking-wide text-ink">NEXUS LOGISTICS</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-mute">
              Intelligent last-mile optimization
            </p>
          </div>
        </NavLink>
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Primary">
          <NavLink
            to="/presentation"
            className={({ isActive }) =>
              `px-3 py-2 font-sans text-[13px] font-semibold transition ${
                isActive ? "bg-coral text-ink" : "text-mute hover:text-ink"
              }`
            }
          >
            Presentation
          </NavLink>
          <NavLink
            to="/optimizer"
            className={({ isActive }) =>
              `px-3 py-2 font-sans text-[13px] font-semibold transition ${
                isActive ? "bg-coral text-ink" : "text-mute hover:text-ink"
              }`
            }
          >
            Optimizer Lab
          </NavLink>
        </nav>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
