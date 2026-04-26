import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/features/**/*.{ts,tsx}",
    "./src/hooks/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
    "./src/contexts/**/*.{ts,tsx}",
  ],
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
      },
      keyframes: {
        fadeInSlide: {
          from: { opacity: '0', transform: 'translateX(1rem)' },
          to:   { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        fadeInSlide: 'fadeInSlide 0.25s ease',
      },
    }
  },
  plugins: []
};

export default config;
