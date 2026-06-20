import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist)", "system-ui", "sans-serif"],
      },
      colors: {
        // Acento principal: ámbar/caramelo (el "amarillo mocha").
        brand: {
          50: "#fbf3e7",
          100: "#f6e4c8",
          200: "#eecb98",
          300: "#e4ac66",
          400: "#d9933f",
          500: "#c87d2b",
          600: "#ab6322",
          700: "#894c1f",
          800: "#6f3e1e",
          900: "#5c351d",
        },
        // Neutros cálidos (reemplazan el gris frío "slate" en toda la app):
        // crema en claro, marrón mocha oscuro en dark mode.
        slate: {
          50: "#faf6ef",
          100: "#f3ebdf",
          200: "#e7d8c3",
          300: "#d6c0a1",
          400: "#b59c79",
          500: "#937a58",
          600: "#735e44",
          700: "#574734",
          800: "#3a2f24",
          900: "#261e17",
          950: "#171108",
        },
        // Segundo acento del gradiente: terracota cálida (antes violeta).
        violet: {
          50: "#fbf0ea",
          100: "#f5dccf",
          200: "#e9b89f",
          300: "#db9270",
          400: "#cd7249",
          500: "#bd5d36",
          600: "#a14a2c",
          700: "#813a25",
          800: "#683024",
          900: "#562a21",
        },
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out",
        "scale-in": "scale-in 0.25s ease-out",
        shimmer: "shimmer 1.5s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
