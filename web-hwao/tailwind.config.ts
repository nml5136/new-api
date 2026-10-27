/** @type {import('tailwindcss').Config} */
const scale = (name: string) => ({
  50: `oklch(var(--${name}-50) / <alpha-value>)`,
  100: `oklch(var(--${name}-100) / <alpha-value>)`,
  200: `oklch(var(--${name}-200) / <alpha-value>)`,
  300: `oklch(var(--${name}-300) / <alpha-value>)`,
  400: `oklch(var(--${name}-400) / <alpha-value>)`,
  500: `oklch(var(--${name}-500) / <alpha-value>)`,
  600: `oklch(var(--${name}-600) / <alpha-value>)`,
  700: `oklch(var(--${name}-700) / <alpha-value>)`,
  800: `oklch(var(--${name}-800) / <alpha-value>)`,
  900: `oklch(var(--${name}-900) / <alpha-value>)`,
  950: `oklch(var(--${name}-950) / <alpha-value>)`,
});

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: scale("background"),
        foreground: scale("foreground"),
        primary: scale("primary"),
        accent: scale("accent"),
        secondary: scale("secondary"),
      },
      fontFamily: {
        sans: ["var(--font-body)"],
        body: ["var(--font-body)"],
        heading: ["var(--font-heading)"],
        display: ["var(--font-heading)"],
        label: ["var(--font-label)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        xl2: "18px",
      },
      boxShadow: {
        soft: "0 1px 2px oklch(var(--background-950) / 0.04), 0 12px 32px -18px oklch(var(--background-950) / 0.18)",
        lift: "0 24px 60px -32px oklch(var(--background-950) / 0.35)",
      },
      maxWidth: {
        shell: "1600px",
      },
    },
  },
  plugins: [],
};