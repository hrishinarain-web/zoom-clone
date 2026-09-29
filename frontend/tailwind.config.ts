import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        zoom: {
          blue: "#0B5CFF",
          "blue-hover": "#0E4BD8",
          "blue-light": "#E8F0FF",
          orange: "#FF742E",
          "orange-hover": "#F0651F",
          text: "#131619",
          muted: "#6E7680",
          border: "#E4E6EA",
          bg: "#F7F8FA",
          red: "#E02828",
          green: "#23D959",
        },
        room: {
          bg: "#1A1A1A",
          tile: "#242424",
          bar: "#1C1C1C",
          hover: "#2E2E2E",
          panel: "#FFFFFF",
        },
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "'Segoe UI'", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(19,22,25,0.06), 0 4px 16px rgba(19,22,25,0.06)",
        pop: "0 8px 32px rgba(0,0,0,0.18)",
      },
      keyframes: {
        floatUp: {
          "0%": { transform: "translateY(0) scale(0.8)", opacity: "0" },
          "15%": { opacity: "1", transform: "translateY(-10px) scale(1)" },
          "100%": { transform: "translateY(-220px)", opacity: "0" },
        },
        fadeIn: { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        floatUp: "floatUp 3s ease-out forwards",
        fadeIn: "fadeIn 150ms ease-out",
      },
    },
  },
  plugins: [],
} satisfies Config;
