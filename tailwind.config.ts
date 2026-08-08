import type { Config } from "tailwindcss";

/**
 * Light theme, matched to Rain and Monad's real sites, sampled directly, not guessed.
 *
 * Rain (rain.xyz): white page, near-black text, one sharp magenta accent (#ff2fb6) on
 * pill-shaped black or pink buttons.
 * Monad (monad.xyz): white page, black text, one indigo-purple accent (#6e54ff).
 *
 * Rain is the primary host and the main "why" of the pitch, so pink is the primary accent
 * throughout. Monad's purple is used narrowly, wherever the rule-version anchor is shown,
 * so both sponsors are represented without muddying the primary action colour.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        ink: {
          DEFAULT: "#121212", // Rain's own body-text black
          50: "#fafafb", 100: "#f2f3f5", 200: "#e5e7eb", 300: "#cdd1d9",
          400: "#9aa1ad", 500: "#6b7280", 600: "#4b5160", 700: "#333844",
          800: "#1e2129", 900: "#121212",
        },
        rain: {
          50: "#fff0fa", 100: "#ffdcf3", 200: "#ffb3e6", 300: "#ff7fd6",
          400: "#ff4ec3", 500: "#ff2fb6", 600: "#e0139a", 700: "#b30f7c",
        },
        monad: {
          50: "#f1efff", 100: "#e3e0ff", 300: "#a99cff", 500: "#6e54ff", 700: "#4c37cc",
        },
        mint: {
          50: "#ecfdf1", 100: "#d3fbdf", 200: "#a9f5c1", 300: "#82ed8e",
          400: "#4ad96b", 500: "#21bd4b", 600: "#12993b", 700: "#117932",
        },
        danger: { 50: "#fef3f2", 200: "#fecdca", 500: "#ef4444", 700: "#b42318" },

        // Console tokens, redefined for a light ground. Same names, so components that
        // reference them shift automatically.
        panel: "#ffffff",
        edge: "#e7e9ee",
        muted: "#6b7280",
        pass: "#0f9d58",
        fail: "#e0193f",
        warn: "#b7791f",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
      keyframes: {
        "row-in": {
          "0%": { opacity: "0", transform: "translateY(-4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pop": {
          "0%": { transform: "scale(0.97)" },
          "60%": { transform: "scale(1.01)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        "row-in": "row-in 260ms ease-out",
        pop: "pop 220ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
