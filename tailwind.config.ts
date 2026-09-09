import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        // McMaster brand maroon (#7A003C) as a full scale so it can carry
        // borders, hovers and tints, not just the one flat brand colour.
        maroon: {
          50: "#FDF2F7",
          100: "#FBE3EC",
          200: "#F6C7D9",
          300: "#EE9CBB",
          400: "#E06694",
          500: "#C93D72",
          600: "#A82459",
          700: "#7A003C",
          800: "#660032",
          900: "#520028",
          950: "#330019"
        },
        "mcmaster-maroon": "#7A003C",
        "mcmaster-gold": "#FDBF57",
        "mcmaster-light": "#F5F0ED"
      },
      fontFamily: {
        display: ['"Georgia"', '"Times New Roman"', "serif"]
      }
    }
  },
  plugins: []
};

export default config;
