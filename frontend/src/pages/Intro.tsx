import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { BrandLogo } from "../components/BrandLogo";

interface IntroProps {
  onEnter: () => void;
}

export function Intro({ onEnter }: IntroProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 30);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <main className="min-h-[100dvh] bg-paper text-ink">
      <div className="mx-auto flex min-h-[100dvh] max-w-[1080px] flex-col px-6 py-8 sm:px-10">
        <header className="flex items-center gap-3">
          <BrandLogo className="h-10 w-10 shrink-0" aria-hidden />
          <div>
            <p className="font-sans text-[15px] font-semibold">Nexus</p>
            <p className="font-sans text-[13px] text-mute">Delivery route planner · JP-019</p>
          </div>
        </header>

        <section className={`mt-14 max-w-3xl transition duration-500 ${ready ? "opacity-100" : "opacity-0"}`}>
          <p className="font-sans text-[14px] font-medium text-coral">What this app is</p>
          <h1 className="mt-3 font-sans text-[40px] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[52px]">
            A tool for dispatch managers to plan van deliveries without breaking rules.
          </h1>
          <p className="mt-5 max-w-[52ch] font-sans text-[18px] leading-relaxed text-mute">
            You load today’s Bengaluru stops, build a simple route plan, then improve it with an optimizer. The app
            never lets vans take more packages than they can carry, and never ignores delivery time windows.
          </p>
        </section>

        <section className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            {
              title: "The problem",
              body: "Naive routing creates late deliveries, wasted kilometres, and angry customers.",
            },
            {
              title: "What you do here",
              body: "Click Naive plan, then Smart optimize, and read the scoreboard to see the win.",
            },
            {
              title: "What you get",
              body: "A map of van routes, driver stop lists, late-risk warnings, and downloadable sheets.",
            },
          ].map((card) => (
            <article key={card.title} className="border border-hairline bg-snow p-5">
              <h2 className="font-sans text-[15px] font-semibold text-ink">{card.title}</h2>
              <p className="mt-2 font-sans text-[14px] leading-relaxed text-mute">{card.body}</p>
            </article>
          ))}
        </section>

        <section className="mt-10 border border-ink bg-snow p-6 sm:p-8">
          <h2 className="font-sans text-[20px] font-semibold">Try it in 3 clicks</h2>
          <ol className="mt-4 space-y-3 font-sans text-[15px] text-ink">
            <li>
              <span className="font-semibold text-coral">1.</span> Open the console (button below).
            </li>
            <li>
              <span className="font-semibold text-coral">2.</span> Press <strong>Naive plan</strong> to see a weak schedule.
            </li>
            <li>
              <span className="font-semibold text-coral">3.</span> Press <strong>Smart optimize</strong> to improve it.
            </li>
          </ol>
          <button
            type="button"
            onClick={onEnter}
            className="mt-7 inline-flex min-h-12 items-center gap-2 bg-coral px-7 py-3 font-sans text-[16px] font-semibold text-ink transition hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Open the delivery console
            <ArrowRight size={18} aria-hidden />
          </button>
          <p className="mt-3 font-sans text-[13px] text-mute">Demo data is already loaded. No signup.</p>
        </section>

        <footer className="mt-auto flex flex-wrap justify-between gap-3 pt-10 font-sans text-[12px] text-mute">
          <span>Built for Aavishkara ’26 · IBM Round 2</span>
          <span>Uses free maps, road routing, and weather</span>
        </footer>
      </div>
    </main>
  );
}
