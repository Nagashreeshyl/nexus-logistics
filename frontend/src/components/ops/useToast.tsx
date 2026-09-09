import { useCallback, useState } from "react";

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<"ok" | "err">("ok");

  const show = useCallback((msg: string, t: "ok" | "err" = "ok") => {
    setTone(t);
    setMessage(msg);
    window.setTimeout(() => setMessage(null), 3500);
  }, []);

  const toastEl = message ? (
    <div
      className={`fixed bottom-4 right-4 z-[60] max-w-sm border px-4 py-3 font-sans text-[13px] font-semibold shadow-card ${
        tone === "ok" ? "border-ink bg-snow text-ink" : "border-coral bg-snow text-coral"
      }`}
      role="status"
    >
      {message}
    </div>
  ) : null;

  return { show, toastEl };
}
