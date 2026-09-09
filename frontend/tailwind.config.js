/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F7F6F2",
        ink: "#0A0A0A",
        ice: "#92CFF2",
        coral: "#F47C59",
        espresso: "#241208",
        mute: "#8A8A8A",
        hairline: "#D6D4CE",
        snow: "#FFFFFF",
        zincish: "#8A8A8A",
        border: "#D6D4CE",
        ok: "#0A0A0A",
        late: "#F47C59",
        muted: "#8A8A8A",
        lavender: "#EFEDE8",
        orange: "#F47C59",
        pink: "#F47C59",
        line: "#D6D4CE",
        lime: "#92CFF2",
        pulse: "#92CFF2",
        void: "#F7F6F2",
        panel: "#FFFFFF",
        graphite: "#0A0A0A",
      },
      fontFamily: {
        sans: ["Outfit", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["Outfit", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      borderRadius: {
        card: "0px",
      },
      boxShadow: {
        panel: "0 18px 40px rgba(10,10,10,0.12)",
        glow: "0 0 0 1px rgba(10,10,10,0.06)",
        card: "0 12px 28px rgba(10,10,10,0.08)",
      },
    },
  },
  plugins: [],
};
