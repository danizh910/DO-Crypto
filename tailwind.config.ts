import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#020617",
        card: "#0F172A",
        popover: "#0F172A",
        primary: "#22D3EE",
        secondary: "#6366F1",
        success: "#10B981",
        foreground: "#F8FAFC",
        muted: "#334155",
        "muted-foreground": "#94A3B8",
        destructive: "#EF4444",
        border: "rgba(255,255,255,0.08)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
