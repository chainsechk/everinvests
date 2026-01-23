# EverInvests

Market signal broadcast site. Daily automated signals for Crypto, Forex, Stocks → Telegram funnel.

## Stack
- **Framework:** Astro 5 SSR on Cloudflare Pages
- **Compute:** Cloudflare Workers (signal generation cron)
- **Database:** Cloudflare D1 (SQLite)
- **LLM:** Workers AI (Llama 3.1 8B) for crypto/forex; DeepSeek V3 via OpenRouter for stocks
- **Styling:** Tailwind CSS with custom design tokens

## Schedule (UTC)
| Category | Assets | Update Hours | Days |
|----------|--------|--------------|------|
| Crypto | BTC, ETH | 00, 08, 16 | Daily |
| Forex | USD/JPY, EUR/USD, USD/CAD, AUD/USD | 00, 08, 14 | Weekdays |
| Stocks | 25 tickers (semis, AI, energy) | 17, 21 | Weekdays |

Other cron jobs:
- 01:00 UTC: Accuracy check, monthly analytics cleanup
- 01/07/13/19 UTC: GDELT geopolitical score fetch
- 14:00 UTC weekdays: Benchmark ETF fetch (SPY, XLK, XLE)
- 23:00 UTC: Daily digest, Sunday blog generation

## Signal Logic
1. **Macro context:** DXY vs 20D MA, VIX level, US 10Y → Risk-on/Risk-off/Mixed
2. **Per-asset:** Price vs 20D MA + secondary indicator (funding rate/RSI/relative strength)
3. **Scoring:** 2 bullish = Bullish, 2 bearish = Bearish, else Neutral
4. **LLM:** Generates 1-2 sentence summary from bias + levels

## Directory Structure
```
src/
  pages/              # Astro pages
    api/track.ts      # Analytics endpoint
    og/               # OG image generation (satori → PNG)
    embed/            # Embeddable widget
    [category]/       # Signal pages (crypto, forex, stocks)
    learn/            # Educational content
  components/         # Astro components
  lib/db.ts           # D1 query helpers
  lib/og.ts           # OG image generation

worker/
  src/index.ts        # Cron handler + admin routes
  src/workflows/      # Category-specific DAGs
  src/skills/         # Reusable pipeline steps
  src/data/           # API clients (Binance, TwelveData, AlphaVantage, GDELT)
  src/signals/        # Bias computation, regime detection

migrations/           # D1 schema migrations
```

## DB Tables
- `macro_signals` - shared macro context per time slot
- `signals` - category-level signals with output JSON (bias, summary, quality_flags)
- `asset_signals` - per-ticker breakdown with indicators
- `run_logs` - observability + analytics events
- `accuracy_records` - signal accuracy tracking
- `benchmark_data` - SPY/XLK/XLE daily data
- `gdelt_scores` - geopolitical risk scores
- `blog_posts` - auto-generated weekly summaries
- `analytics_events` - user events (90-day retention)

## Worker Admin Routes
All require `Authorization: Bearer $WORKER_AUTH_TOKEN`:
- `GET /trigger?category=crypto` - manual signal run
- `GET /check-accuracy` - run accuracy check
- `GET /fetch-benchmarks` - fetch SPY/XLK/XLE
- `GET /fetch-gdelt` - fetch geopolitical score
- `GET /send-daily-digest` - send Telegram digest
- `GET /generate-weekly-blog` - generate blog posts

## Data Sources & Limits
| Source | Limit | Usage |
|--------|-------|-------|
| TwelveData | 800 req/day, 8/min | Forex, stocks, benchmarks |
| Alpha Vantage | 25 req/day | Macro (DXY, VIX, yields) |
| Binance | Unlimited | Crypto price + funding |
| GDELT | Unlimited | Geopolitical news score |

## Deployment
```bash
npm run deploy:prod     # Pages to production
npm run deploy:preview  # Pages to preview
npm run worker:deploy   # Worker to production
npm run db:migrate:remote  # Apply D1 migrations
```

## Key Patterns
- **OG images:** Satori SVG → resvg PNG (falls back to SVG if WASM fails)
- **Workflows:** DAG-based skill orchestration with version tracking
- **Migrations:** Use `IF NOT EXISTS` for idempotency
- **Analytics:** Events stored in `analytics_events`, 90-day retention

## Constraints
- Workers CPU: 10ms/invocation (keep logic simple)
- No user accounts - anonymous visitors only
- Telegram is the conversion funnel
- GitHub not synced to Cloudflare (manual deploys)
