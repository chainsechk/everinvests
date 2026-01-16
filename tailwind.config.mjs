/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        // Core palette - Terminal Luxe
        void: {
          DEFAULT: "#0a0e17",
          50: "#141a24",
          100: "#1a2332",
          200: "#232d3f",
        },
        // Signal colors with glow variants
        bullish: {
          DEFAULT: "#00ff88",
          glow: "rgba(0, 255, 136, 0.4)",
          dim: "rgba(0, 255, 136, 0.15)",
        },
        bearish: {
          DEFAULT: "#ff4466",
          glow: "rgba(255, 68, 102, 0.4)",
          dim: "rgba(255, 68, 102, 0.15)",
        },
        neutral: {
          DEFAULT: "#5e6e82",
          glow: "rgba(94, 110, 130, 0.4)",
          dim: "rgba(94, 110, 130, 0.15)",
        },
        // Macro sentiment
        riskon: "#00ff88",
        riskoff: "#ff4466",
        mixed: "#fbbf24",
        // Accent colors
        cyber: {
          DEFAULT: "#00d4ff",
          glow: "rgba(0, 212, 255, 0.4)",
        },
        // Text hierarchy
        txt: {
          primary: "#f8fafc",
          secondary: "#94a3b8",
          muted: "#5e6e82",
        },
      },
      fontFamily: {
        display: ['"Outfit"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'grid-flow': 'gridFlow 20s linear infinite',
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.6s ease-out forwards',
        'ticker': 'ticker 30s linear infinite',
      },
      keyframes: {
        glow: {
          '0%': { opacity: '0.5' },
          '100%': { opacity: '1' },
        },
        gridFlow: {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(50px)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      boxShadow: {
        'glow-bullish': '0 0 20px rgba(0, 255, 136, 0.3), 0 0 40px rgba(0, 255, 136, 0.1)',
        'glow-bearish': '0 0 20px rgba(255, 68, 102, 0.3), 0 0 40px rgba(255, 68, 102, 0.1)',
        'glow-cyber': '0 0 20px rgba(0, 212, 255, 0.3), 0 0 40px rgba(0, 212, 255, 0.1)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.4)',
      },
      backgroundImage: {
        'grid-pattern': `linear-gradient(rgba(0, 212, 255, 0.03) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(0, 212, 255, 0.03) 1px, transparent 1px)`,
        'gradient-radial': 'radial-gradient(ellipse at center, var(--tw-gradient-stops))',
      },
      backgroundSize: {
        'grid': '50px 50px',
      },
    },
  },
  plugins: [],
};
