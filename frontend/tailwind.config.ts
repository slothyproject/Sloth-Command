import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "#0d1520",
        surface: "rgba(15, 23, 40, 0.85)",
        panel: "#182c48",
        raised: "#1a3550",
        cyan: "#88c0d0",
        lime: "#a3be8c",
        amber: "#b8956a",
        danger: "#d08070",
        line: "rgba(136, 192, 208, 0.18)",
        text: {
          0: "#e8f1fa",
          1: "#d0dce8",
          2: "#8fa8c4",
          3: "#5f7a96"
        },
        "sloth-green": "#a3be8c",
        "sloth-purple": "#b48ead",
        "sloth-gold": "#b8956a",
        "sloth-ember": "#d08070"
      },
      fontFamily: {
        mono: ["JetBrains Mono", "monospace"],
        sans: ["Manrope", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Manrope", "system-ui", "sans-serif"]
      },
      boxShadow: {
        cyan: "0 18px 38px rgba(136, 192, 208, 0.15)",
        accent: "0 18px 38px rgba(136, 192, 208, 0.15)",
        panel: "0 24px 70px rgba(13, 21, 32, 0.55)",
        glow: "0 0 0 1px rgba(136, 192, 208, 0.1) inset, 0 18px 40px rgba(136, 192, 208, 0.12)"
      },
      backdropBlur: {
        chrome: "18px"
      }
    }
  },
  plugins: []
} satisfies Config;