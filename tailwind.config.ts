import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--bg)",
        panel: "var(--panel)",
        "panel-2": "var(--panel-2)",
        border: "var(--border-c)",
        "border-strong": "var(--border-strong)",
        muted: "var(--muted-c)",
        accent: "#3b82f6",
        profit: "#10b981",
        loss: "#ef4444",
        warn: "#f59e0b",
        violet: "#8b5cf6",
      },
      fontFamily: {
        sans: [
          "ui-sans-serif",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: ["ui-monospace", "Cascadia Mono", "Consolas", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(59,130,246,0.18)",
      },
    },
  },
  plugins: [],
};
export default config;
