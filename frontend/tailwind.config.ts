import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Sloth Lee Cyber-Punk Theme - Bright Neon Edition
        void: "#0a1420",
        "void-dark": "#050a14",
        surface: "rgba(15, 26, 46, 0.85)",
        "surface-strong": "rgba(21, 34, 56, 0.9)",
        panel: "#152238",
        "panel-light": "#1a2d42",
        raised: "#1f3a52",
        
        // Primary Neon Colors
        cyan: "#00d4ff", // Bright neon cyan (primary)
        "cyan-dark": "#00a8cc",
        "cyan-light": "#33dcff",
        "cyan-glow": "rgba(0, 212, 255, 0.25)",
        
        // Secondary Colors
        lime: "#00ff88", // Bright neon lime
        "lime-dark": "#00cc6a",
        "lime-glow": "rgba(0, 255, 136, 0.2)",
        
        // Accent Colors
        amber: "#ffb830", // Warm gold/amber
        "amber-glow": "rgba(255, 184, 48, 0.15)",
        danger: "#ff4455", // Bright red
        "danger-glow": "rgba(255, 68, 85, 0.15)",
        
        // Legacy colors (kept for compatibility)
        "sloth-green": "#00ff88",
        "sloth-purple": "#bd93f9",
        "sloth-gold": "#ffb830",
        "sloth-ember": "#ff4455",
        
        // Text hierarchy
        line: "rgba(0, 212, 255, 0.12)",
        text: {
          0: "#e2ebf5",
          1: "#b8cfe1",
          2: "#7a95b1",
          3: "#4d6680"
        },
      },
      fontFamily: {
        mono: ["JetBrains Mono", "monospace"],
        sans: ["Manrope", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Manrope", "system-ui", "sans-serif"]
      },
      boxShadow: {
        cyan: "0 0 20px rgba(0, 212, 255, 0.3)",
        "cyan-glow": "0 0 30px rgba(0, 212, 255, 0.25), inset 0 0 30px rgba(0, 212, 255, 0.15)",
        "lime-glow": "0 0 20px rgba(0, 255, 136, 0.2)",
        accent: "0 18px 38px rgba(0, 212, 255, 0.15)",
        panel: "0 24px 70px rgba(10, 20, 32, 0.55)",
        glow: "0 0 0 1px rgba(0, 212, 255, 0.12) inset, 0 18px 40px rgba(0, 212, 255, 0.1)",
        "neon-edge": "inset 0 0 20px rgba(0, 212, 255, 0.1), 0 0 40px rgba(0, 212, 255, 0.15)"
      },
      backdropBlur: {
        chrome: "18px"
      }
    }
  },
  plugins: []
} satisfies Config;