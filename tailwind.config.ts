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
        "mcmaster-maroon": "#7A003C",
        "mcmaster-gold": "#FDBF57",
        "mcmaster-light": "#F5F0ED"
      }
    }
  },
  plugins: []
};
 
export default config;

