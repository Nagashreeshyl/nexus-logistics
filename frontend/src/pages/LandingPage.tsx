import { Link } from "react-router-dom";
import { BrandLogo } from "../components/BrandLogo";

export function LandingPage() {
  return (
    <div className="relative flex min-h-[calc(100dvh-65px)] flex-col justify-center overflow-hidden bg-paper px-6 py-16 text-ink md:px-12">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 45% at 15% 15%, rgba(244,124,89,0.12), transparent 55%), radial-gradient(ellipse 50% 35% at 90% 85%, rgba(146,207,242,0.14), transparent 50%)",
        }}
      />
      <div className="relative mx-auto w-full max-w-4xl">
        <div className="mb-10 flex items-center gap-3">
          <BrandLogo className="h-10 w-10" />
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">Avishkara&apos;26 · JP-019</p>
        </div>
        <h1 className="font-sans text-[clamp(2.5rem,8vw,5.5rem)] font-semibold leading-[0.95] tracking-tight">
          NEXUS
          <br />
          LOGISTICS
        </h1>
        <p className="mt-6 max-w-xl font-sans text-[clamp(1.1rem,2.5vw,1.5rem)] leading-snug text-mute">
          Last-Mile Delivery Route Optimizer
          <br />
          &amp; Late-Delivery Risk Predictor
        </p>
        <p className="mt-8 font-mono text-[12px] uppercase tracking-[0.16em] text-mute">Code with Errors</p>
        <div className="mt-12 flex flex-wrap gap-3">
          <Link
            to="/presentation"
            className="bg-coral px-6 py-3.5 font-sans text-[14px] font-semibold text-ink no-underline transition hover:brightness-110"
          >
            Enter Presentation
          </Link>
          <Link
            to="/optimizer"
            className="border border-hairline bg-snow px-6 py-3.5 font-sans text-[14px] font-semibold text-ink no-underline transition hover:border-ink"
          >
            Open Optimizer Lab
          </Link>
        </div>
      </div>
    </div>
  );
}
