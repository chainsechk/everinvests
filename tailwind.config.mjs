/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        bullish: "#22c55e",    // green-500
        bearish: "#ef4444",    // red-500
        neutral: "#6b7280",    // gray-500
        riskon: "#22c55e",     // green-500
        riskoff: "#ef4444",    // red-500
        mixed: "#f59e0b",      // amber-500
      },
    },
  },
  plugins: [],
};
