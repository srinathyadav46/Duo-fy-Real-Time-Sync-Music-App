/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      // ─── Brand Color Palette ───────────────────────────────────────────────
      colors: {
        // Deep dark backgrounds
        void: {
          DEFAULT: "#080810",
          50:  "#f4f4f8",
          100: "#e8e8f0",
          200: "#c8c8dc",
          300: "#9898b8",
          400: "#606080",
          500: "#383852",
          600: "#22223a",
          700: "#141428",
          800: "#0e0e1e",
          900: "#080810",
          950: "#040408",
        },
        // Romantic rose accent
        rose: {
          DEFAULT: "#e8799a",
          50:  "#fdf2f5",
          100: "#fce4ec",
          200: "#f9bdd1",
          300: "#f490b0",
          400: "#ee6b92",
          500: "#e8799a",
          600: "#d44d72",
          700: "#b33a5a",
          800: "#8f2d45",
          900: "#6b2135",
        },
        // Warm blush for subtle surfaces
        blush: {
          DEFAULT: "#2a1420",
          50:  "#fdf0f4",
          100: "#f9d8e4",
          200: "#f0b0c8",
          300: "#e080a0",
          400: "#c85078",
          500: "#3d1a2a",
          600: "#2a1420",
          700: "#1e0e18",
          800: "#140810",
          900: "#0a0408",
        },
        // Soft gold accent for premium feel
        gold: {
          DEFAULT: "#c9956a",
          400: "#e0b48a",
          500: "#c9956a",
          600: "#a87448",
        },
      },

      // ─── Typography ────────────────────────────────────────────────────────
      fontFamily: {
        display: ["'Cormorant Garamond'", "Georgia", "serif"],
        body:    ["'Jost'", "system-ui", "sans-serif"],
        mono:    ["'JetBrains Mono'", "monospace"],
      },

      // ─── Spacing / Sizing Tokens ───────────────────────────────────────────
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },

      // ─── Custom Shadows ────────────────────────────────────────────────────
      boxShadow: {
        // Romantic ambient glow
        "glow-rose":  "0 0 40px 8px rgba(232, 121, 154, 0.18)",
        "glow-rose-lg":"0 0 80px 20px rgba(232, 121, 154, 0.12)",
        "glow-gold":  "0 0 30px 6px rgba(201, 149, 106, 0.15)",
        // Card depth
        "card":       "0 8px 32px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3)",
        "card-hover": "0 16px 48px rgba(0,0,0,0.65), 0 4px 12px rgba(232,121,154,0.1)",
        // Inner glows
        "inner-rose": "inset 0 1px 0 rgba(232,121,154,0.15)",
      },

      // ─── Background Size (for animated gradients) ──────────────────────────
      backgroundSize: {
        "200%": "200% 200%",
        "400%": "400% 400%",
      },

      // ─── Keyframe Animations ──────────────────────────────────────────────
      keyframes: {
        // Gentle fade in with upward drift
        fadeUp: {
          "0%":   { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        // Soft scale-in
        fadeIn: {
          "0%":   { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        // Pulsing glow ring
        glow: {
          "0%, 100%": { boxShadow: "0 0 20px 4px rgba(232,121,154,0.2)" },
          "50%":      { boxShadow: "0 0 40px 10px rgba(232,121,154,0.35)" },
        },
        // Floating ambient orb
        float: {
          "0%, 100%": { transform: "translateY(0px) scale(1)" },
          "50%":      { transform: "translateY(-24px) scale(1.04)" },
        },
        // Slow gradient shift
        gradientShift: {
          "0%":   { backgroundPosition: "0% 50%" },
          "50%":  { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        // Waveform bar bounce
        waveBounce: {
          "0%, 100%": { transform: "scaleY(0.3)" },
          "50%":      { transform: "scaleY(1)" },
        },
        // Sync flash
        syncFlash: {
          "0%":   { opacity: "0", transform: "translateY(4px)" },
          "20%":  { opacity: "1", transform: "translateY(0)" },
          "80%":  { opacity: "1" },
          "100%": { opacity: "0" },
        },
        // Spinner
        spin: {
          to: { transform: "rotate(360deg)" },
        },
      },

      // ─── Animation Utilities ───────────────────────────────────────────────
      animation: {
        "fade-up":       "fadeUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "fade-in":       "fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        "glow":          "glow 3s ease-in-out infinite",
        "float":         "float 6s ease-in-out infinite",
        "float-slow":    "float 9s ease-in-out infinite",
        "gradient":      "gradientShift 8s ease infinite",
        "wave":          "waveBounce 1.2s ease-in-out infinite",
        "sync-flash":    "syncFlash 2.5s ease-in-out forwards",
        "spin-slow":     "spin 1.4s linear infinite",
      },
    },
  },
  plugins: [],
};