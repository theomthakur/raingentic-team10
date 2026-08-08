import type { Config } from "tailwindcss";

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
          50: "#f7f7f8", 100: "#eceef1", 200: "#d9dde3", 300: "#b7bfc9",
          400: "#8a94a3", 500: "#5f6b7a", 600: "#454f5c", 700: "#2f3742",
          800: "#1b2027", 900: "#0d1013",
        },
        mint: {
          50: "#ecfdf1", 100: "#d3fbdf", 200: "#a9f5c1", 300: "#82ed8e",
          400: "#4ad96b", 500: "#21bd4b", 600: "#12993b", 700: "#117932",
        },
        danger: { 50: "#fef3f2", 200: "#fecdca", 500: "#ef4444", 700: "#b42318" },
      },
    },
  },
  plugins: [],
};

export default config;
