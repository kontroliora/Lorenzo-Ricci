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
        // Brand dark (header, footer, CTAs)
        charcoal: {
          DEFAULT: "#1A1A1A",
          deep: "#0A0A0A",
          soft: "#2A2A2A",
        },
        // Page surfaces - light luxury
        ivory: {
          DEFAULT: "#FAFAF8",
          warm: "#F5F3F0",
          paper: "#F0EDE8",
          card: "#FFFFFF",
        },
        // Gold accent - kept for image references
        gold: {
          DEFAULT: "#C9A84C",
          light: "#D4AF37",
          pale: "#E8D5A3",
          dark: "#9A7B2C",
          border: "rgba(201,168,76,0.3)",
        },
        // Navy blue - primary accent replacing gold
        navy: {
          DEFAULT: "#0F2850",
          light: "#1A3A6B",
          pale: "#E8EDF5",
          dark: "#071A38",
          border: "rgba(15,40,80,0.2)",
        },
        // Text scale (on light bg)
        ink: {
          DEFAULT: "#1A1A1A",
          soft: "#444444",
          muted: "#777777",
          faint: "#AAAAAA",
        },
        // Borders
        border: {
          DEFAULT: "#E0DDD8",
          gold: "rgba(201,168,76,0.35)",
          navy: "rgba(15,40,80,0.15)",
          strong: "#C8C4BC",
        },
      },
      fontFamily: {
        serif: ["var(--font-cormorant)", "Georgia", "serif"],
        sans: ["var(--font-jost)", "system-ui", "sans-serif"],
      },
      fontSize: {
        "display-xl": ["clamp(3rem, 8vw, 7rem)", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        "display-lg": ["clamp(2.25rem, 5vw, 4.5rem)", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "display-md": ["clamp(1.75rem, 3.5vw, 3rem)", { lineHeight: "1.15", letterSpacing: "-0.01em" }],
        "display-sm": ["clamp(1.25rem, 2.5vw, 2rem)", { lineHeight: "1.2" }],
      },
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
        "26": "6.5rem",
        "30": "7.5rem",
      },
      transitionTimingFunction: {
        luxury: "cubic-bezier(0.25, 0.1, 0.25, 1)",
        "luxury-out": "cubic-bezier(0, 0, 0.2, 1)",
      },
      transitionDuration: {
        "400": "400ms",
        "600": "600ms",
        "800": "800ms",
      },
      animation: {
        "fade-up": "fadeUp 0.7s cubic-bezier(0.25, 0.1, 0.25, 1) forwards",
        "fade-in": "fadeIn 0.6s cubic-bezier(0.25, 0.1, 0.25, 1) forwards",
        "slide-left": "slideLeft 0.4s cubic-bezier(0.25, 0.1, 0.25, 1) forwards",
        "slide-right": "slideRight 0.4s cubic-bezier(0.25, 0.1, 0.25, 1) forwards",
        "notification-in": "notificationIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "notification-out": "notificationOut 0.4s cubic-bezier(0.25, 0.1, 0.25, 1) forwards",
        "ping-slow": "ping 2.5s cubic-bezier(0, 0, 0.2, 1) infinite",
        "spin-slow": "spin 1s linear infinite",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(28px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideLeft: {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        slideRight: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(100%)" },
        },
        notificationIn: {
          from: { opacity: "0", transform: "translateX(-110%)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        notificationOut: {
          from: { opacity: "1", transform: "translateX(0)" },
          to: { opacity: "0", transform: "translateX(-110%)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
