# EverInvests

Market signal broadcast site. Automated signals for Crypto, Forex, Stocks → Telegram funnel.

## Stack
- **Frontend:** Astro 5 SSR on Cloudflare Pages
- **Backend:** Cloudflare Workers (cron jobs)
- **Database:** Cloudflare D1 (SQLite)
- **Styling:** Tailwind CSS with custom design tokens in `global.css`

## Directory Structure
```
src/
  pages/           # Astro routes
    api/           # REST endpoints
    og/            # OG image generation (satori → PNG)
    [category]/    # Signal pages (crypto, forex, stocks)
  components/      # Astro components
  lib/
    db.ts          # D1 query helpers
    site.ts        # URL utilities (absoluteUrl, SITE_URL)
    i18n.ts        # Locale-aware formatting (formatDate, formatNumber)
  middleware.ts    # SSR cache headers

worker/
  src/
    index.ts       # Cron handler + admin routes
    workflows/     # Signal generation pipelines
    data/          # API clients (Binance, TwelveData, AlphaVantage)
    signals/       # Bias computation logic

migrations/        # D1 schema (use IF NOT EXISTS)
```

## Key Tables
- `signals` - category-level signals (bias, summary, quality_flags in output_json)
- `asset_signals` - per-ticker data (price, vs_20d_ma, secondary_ind)
- `macro_signals` - market context (dxy_bias, vix_level, yields_bias)

## Commands
```bash
npm run dev              # Local dev server
npm run build            # Build for production
npm run deploy:prod      # Deploy Pages to production
npm run worker:deploy    # Deploy Worker
npm run db:migrate:remote # Apply D1 migrations
```

## Constraints
- **Workers CPU:** 10ms limit - keep logic simple
- **API limits:** TwelveData 800/day, Alpha Vantage 25/day
- **No auth:** Anonymous visitors only, Telegram is conversion funnel
- **Manual deploys:** GitHub not synced to Cloudflare

## Patterns
- Use `absoluteUrl()` from `lib/site.ts` for all URLs (not hardcoded domains)
- Use `formatDate/formatNumber` from `lib/i18n.ts` (not toLocaleDateString)
- OG images: Satori SVG → resvg PNG (fallback to SVG if WASM fails)
- Migrations must be idempotent (`IF NOT EXISTS`)
