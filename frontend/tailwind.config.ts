import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#f6f5ef",
        ink: "#111827",
        panel: "#fefcf8",
        "border-default": "#d4d0c8",
        accent: "#f97316",
        accent2: "#0f766e",
        primary: {
          DEFAULT: "#7c3aed",
          hover: "#6d28d9",
          light: "#a78bfa",
        },
        surface: {
          DEFAULT: "#18181b",
          elevated: "#27272a",
        },
      },
      fontFamily: {
        sans: ["IBM Plex Sans", "ui-sans-serif", "system-ui"],
        display: ["Space Grotesk", "ui-sans-serif", "system-ui"]
      },
      boxShadow: {
        soft: "0 10px 30px rgba(0,0,0,0.08)",
        glow: "0 0 20px rgba(124,58,237,0.3)",
        "glow-sm": "0 0 12px rgba(124,58,237,0.2)",
      }
    },
  },
  plugins: [],
};

export default config;
