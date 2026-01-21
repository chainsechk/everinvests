/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        // Theme-aware colors using CSS variables
        bg: {
          primary: "var(--bg-primary)",
          secondary: "var(--bg-secondary)",
          tertiary: "var(--bg-tertiary)",
          elevated: "var(--bg-elevated)",
        },
        txt: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          tertiary: "var(--text-muted)",
          inverse: "var(--text-inverse)",
        },
        // Signal colors
        bullish: {
          DEFAULT: "var(--bullish)",
          bg: "var(--bullish-bg)",
          glow: "var(--bullish-bg)",
          dim: "var(--bullish-bg)",
        },
        bearish: {
          DEFAULT: "var(--bearish)",
          bg: "var(--bearish-bg)",
          glow: "var(--bearish-bg)",
          dim: "var(--bearish-bg)",
        },
        neutral: {
          DEFAULT: "var(--neutral)",
          bg: "var(--neutral-bg)",
          glow: "var(--neutral-bg)",
          dim: "var(--neutral-bg)",
        },
        // Accent colors
        accent: {
          DEFAULT: "var(--accent)",
          secondary: "var(--accent-secondary)",
          bg: "var(--accent-bg)",
        },
        cyber: {
          DEFAULT: "var(--accent)",
          glow: "var(--accent-bg)",
        },
        // VIP colors
        vip: {
          DEFAULT: "var(--vip)",
          bg: "var(--vip-bg)",
          glow: "var(--vip-bg)",
        },
        // Legacy void colors for backward compatibility
        // Maps to the new theme-aware CSS variables
        void: {
          DEFAULT: "var(--bg-primary)",
          50: "var(--bg-secondary)",
          100: "var(--bg-tertiary)",
          200: "var(--bg-elevated)",
        },
        // Macro colors
        riskon: "var(--bullish)",
        riskoff: "var(--bearish)",
        mixed: "#fbbf24",
      },
      fontFamily: {
        display: ['"Outfit"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.6s ease-out forwards',
        'ticker': 'ticker 30s linear infinite',
      },
      keyframes: {
        glow: {
          '0%': { opacity: '0.5' },
          '100%': { opacity: '1' },
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
        'glow-bullish': '0 0 20px var(--bullish-bg)',
        'glow-bearish': '0 0 20px var(--bearish-bg)',
        'glow-cyber': '0 0 20px var(--accent-bg)',
        'card': 'var(--shadow-card)',
      },
    },
  },
  plugins: [],
};
