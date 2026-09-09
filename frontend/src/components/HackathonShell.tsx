import { NavLink, Outlet } from "react-router-dom";
import { BrandLogo } from "./BrandLogo";

/**
 * Minimal hackathon chrome — Presentation + Optimizer Lab only.
 */
export function HackathonShell() {
  return (
    <div className="flex min-h-dvh flex-col bg-[#0c0d10] text-[#f2efe8]">
      <header className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 md:px-8">
        <NavLink to="/" className="flex items-center gap-3 no-underline">
          <BrandLogo className="h-7 w-7" />
          <div>
            <p className="font-sans text-[15px] font-semibold tracking-wide text-[#f2efe8]">NEXUS LOGISTICS</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#8b909a]">
              Intelligent last-mile optimization
            </p>
          </div>
        </NavLink>
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Primary">
          <NavLink
            to="/presentation"
            className={({ isActive }) =>
              `px-3 py-2 font-sans text-[13px] font-semibold transition ${
                isActive ? "bg-[#f47c59] text-[#0c0d10]" : "text-[#c5c8cf] hover:text-white"
              }`
            }
          >
            Presentation
          </NavLink>
          <NavLink
            to="/optimizer"
            className={({ isActive }) =>
              `px-3 py-2 font-sans text-[13px] font-semibold transition ${
                isActive ? "bg-[#f47c59] text-[#0c0d10]" : "text-[#c5c8cf] hover:text-white"
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
