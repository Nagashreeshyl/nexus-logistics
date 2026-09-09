import { NavLink, Outlet, useLocation } from "react-router-dom";
import { BrandLogo } from "./BrandLogo";

/**
 * Minimal hackathon chrome — Presentation + Optimizer Lab.
 * Light shell for workbench clarity; presentation paints its own dark stage.
 */
export function HackathonShell() {
  const { pathname } = useLocation();
  const onPresentation = pathname.startsWith("/presentation");
  const dark = onPresentation || pathname === "/";

  return (
    <div className={`flex min-h-dvh flex-col ${dark ? "bg-[#0c0d10] text-[#f2efe8]" : "bg-paper text-ink"}`}>
      <header
        className={`flex items-center justify-between gap-4 px-5 py-4 md:px-8 ${
          dark ? "border-b border-white/10" : "border-b border-hairline bg-snow"
        }`}
      >
        <NavLink to="/" className="flex items-center gap-3 no-underline">
          <BrandLogo className="h-7 w-7" />
          <div>
            <p className={`font-sans text-[15px] font-semibold tracking-wide ${dark ? "text-[#f2efe8]" : "text-ink"}`}>
              NEXUS LOGISTICS
            </p>
            <p
              className={`font-mono text-[10px] uppercase tracking-[0.14em] ${dark ? "text-[#8b909a]" : "text-mute"}`}
            >
              Intelligent last-mile optimization
            </p>
          </div>
        </NavLink>
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Primary">
          <NavLink
            to="/presentation"
            className={({ isActive }) =>
              `px-3 py-2 font-sans text-[13px] font-semibold transition ${
                isActive
                  ? "bg-coral text-ink"
                  : dark
                    ? "text-[#c5c8cf] hover:text-white"
                    : "text-mute hover:text-ink"
              }`
            }
          >
            Presentation
          </NavLink>
          <NavLink
            to="/optimizer"
            className={({ isActive }) =>
              `px-3 py-2 font-sans text-[13px] font-semibold transition ${
                isActive
                  ? "bg-coral text-ink"
                  : dark
                    ? "text-[#c5c8cf] hover:text-white"
                    : "text-mute hover:text-ink"
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
