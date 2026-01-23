/** @type {import('tailwindcss').Config} */
const withAlpha = (value) =>
  `color-mix(in srgb, ${value} calc(<alpha-value> * 100%), transparent)`;

export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        // Theme-aware colors using CSS variables
        bg: {
          primary: withAlpha("var(--bg-primary)"),
          secondary: withAlpha("var(--bg-secondary)"),
          tertiary: withAlpha("var(--bg-tertiary)"),
          elevated: withAlpha("var(--bg-elevated)"),
        },
        txt: {
          primary: withAlpha("var(--text-primary)"),
          secondary: withAlpha("var(--text-secondary)"),
          muted: withAlpha("var(--text-muted)"),
          tertiary: withAlpha("var(--text-muted)"),
          inverse: withAlpha("var(--text-inverse)"),
        },
        // Signal colors
        bullish: {
          DEFAULT: withAlpha("var(--bullish)"),
          bg: withAlpha("var(--bullish-bg)"),
          glow: withAlpha("var(--bullish-bg)"),
          dim: withAlpha("var(--bullish-bg)"),
        },
        bearish: {
          DEFAULT: withAlpha("var(--bearish)"),
          bg: withAlpha("var(--bearish-bg)"),
          glow: withAlpha("var(--bearish-bg)"),
          dim: withAlpha("var(--bearish-bg)"),
        },
        neutral: {
          DEFAULT: withAlpha("var(--neutral)"),
          bg: withAlpha("var(--neutral-bg)"),
          glow: withAlpha("var(--neutral-bg)"),
          dim: withAlpha("var(--neutral-bg)"),
        },
        // Accent colors
        accent: {
          DEFAULT: withAlpha("var(--accent)"),
          secondary: withAlpha("var(--accent-secondary)"),
          bg: withAlpha("var(--accent-bg)"),
        },
        cyber: {
          DEFAULT: withAlpha("var(--accent)"),
          glow: withAlpha("var(--accent-bg)"),
        },
        // VIP colors
        vip: {
          DEFAULT: withAlpha("var(--vip)"),
          bg: withAlpha("var(--vip-bg)"),
          glow: withAlpha("var(--vip-bg)"),
        },
        // Legacy void colors for backward compatibility
        // Maps to the new theme-aware CSS variables
        void: {
          DEFAULT: withAlpha("var(--bg-primary)"),
          50: withAlpha("var(--bg-secondary)"),
          100: withAlpha("var(--bg-tertiary)"),
          200: withAlpha("var(--bg-elevated)"),
        },
        // Macro colors
        riskon: withAlpha("var(--bullish)"),
        riskoff: withAlpha("var(--bearish)"),
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
