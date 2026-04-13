import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#0A2540",
        success: "#2D8A39",
        alert: "#D93025",
        danger: "#991b1b",
        base: "#fafafa",
        steel: "#52525b",
        surface: "#f4f4f5"
      },
      borderRadius: {
        card: "1rem",
        input: "0.75rem",
        button: "0.5rem"
      }
    }
  },
  plugins: []
};

export default config;
