import { useId, useState, type ReactNode } from "react";

interface HelpTipProps {
  label: string;
  tip: string;
  children: ReactNode;
  className?: string;
  /** Hide the visible ? — still exposes title for hover on the control */
  icon?: boolean;
}

/** Explains what/why. Prefer wrapping primary controls; keep icons sparse. */
export function HelpTip({ label, tip, children, className = "", icon = true }: HelpTipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <span
      className={`relative inline-flex items-center gap-1.5 ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
      title={!icon ? tip : undefined}
    >
      {children}
      {icon && (
        <button
          type="button"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center border border-hairline font-mono text-[11px] font-semibold text-mute transition hover:border-ink hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          aria-describedby={open ? id : undefined}
          aria-label={`About ${label}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((v) => !v);
          }}
        >
          ?
        </button>
      )}
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-0 top-[calc(100%+8px)] z-50 w-[min(300px,72vw)] border border-ink bg-snow px-3 py-2.5 font-mono text-[12px] leading-relaxed text-ink shadow-card"
        >
          <span className="sys mb-1 block text-mute">{label}</span>
          {tip}
        </span>
      )}
    </span>
  );
}
