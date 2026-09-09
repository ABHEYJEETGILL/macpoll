import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        mcmaster: {
          maroon: "#7A003C",
          "maroon-dark": "#5C002D",
          gold: "#FDBF57",
          "gold-dark": "#E0A63C"
        }
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        "bar-grow": {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" }
        }
      },
      animation: {
        "fade-in": "fade-in 180ms ease-out",
        "bar-grow": "bar-grow 320ms ease-out"
      }
    }
  },
  plugins: []
};

export default config;
