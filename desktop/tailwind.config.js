/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f7f7f8",
          100: "#eeeef1",
          200: "#d8d8de",
          300: "#b6b6c0",
          400: "#8a8a98",
          500: "#62626f",
          600: "#414150",
          700: "#2b2b36",
          800: "#1c1c25",
          900: "#0f0f16",
        },
        accent: {
          DEFAULT: "#d97757",
          soft: "#f4ead7",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
