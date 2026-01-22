# EverInvests Agent Brief

> Executive summary for AI agents working on this project. Updated 2026-01-22.

## What Is This Project?

**EverInvests** is a market signal broadcast site that generates daily automated trading signals for Crypto, Forex, and Stocks, funneling users to a Telegram channel. The core value proposition: *"We ran money. Now we share our edge."* - open-sourcing a hedge fund team's systematic methodology built over 8+ years.

## Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Frontend | Astro SSR | Cloudflare Pages adapter |
| Compute | Cloudflare Workers | Signal generation cron |
| Database | Cloudflare D1 | SQLite via Workers binding |
| LLM | Workers AI / OpenRouter | Llama 3.1 8B / DeepSeek V3 |
| Notifications | Telegram Bot API | HTML formatted messages |

## Core Signal Logic (The Money Part)

### 3-Indicator Confluence Model
Each asset gets a bias (Bullish/Bearish/Neutral) from 3 truly independent signals:

```
INDICATOR 1: TREND (Price vs 20D MA)
├─ >1% above MA → Bullish
├─ <1% below MA → Bearish
└─ else → Neutral

INDICATOR 2: VOLUME (Vol vs Avg Vol) — NOT price-derived!
├─ >1.2x avg → High (confirms trend)
├─ <0.8x avg → Low (diverges)
└─ else → Neutral

INDICATOR 3: STRENGTH (Asset-class specific)
├─ Crypto: Fear & Greed Index (<30 bullish, >70 bearish)
├─ Forex: Yield Curve (normal=bullish, inverted=bearish)
└─ Stocks: RSI (<30 bullish, >70 bearish)
```

**Rule:** 2+ of 3 signals agree → that direction, else Neutral

### Macro Context
Shared across all categories, assessed from:
- **DXY** (Dollar Index) vs 20D MA → Strong/Weak/Neutral
- **VIX** level → Risk-on (<12) / Risk-off (>20) / Neutral
- **10Y Yield** → Rising (>4.5%) / Falling (<3.5%) / Stable
- **Fear & Greed** → Contrarian override at extremes
- **Yield Curve** (2Y-10Y spread) → Normal/Flat/Inverted

**Overall:** Risk-on / Risk-off / Mixed

## Schedule (All Times UTC)

| Category | Assets | Update Times |
|----------|--------|--------------|
| Crypto | BTC, ETH | 00:00, 08:00, 16:00 |
| Forex | USD/JPY, EUR/USD, USD/CAD, AUD/USD | 00:00, 08:00, 14:00 (weekdays) |
| Stocks | 25 tickers (semis, AI, energy) | 17:00, 21:00 (weekdays) |

## Data Sources & Rate Limits

| Source | Data | Limit | Status |
|--------|------|-------|--------|
| CoinGecko | Crypto OHLCV | Soft limit | Primary (CoinCap fallback) |
| TwelveData | Forex/Stocks | 800/day, 8/min | Batch mode |
| Alpha Vantage | 10Y Yield | 25/day | With fallback |
| Alternative.me | Fear & Greed | Unlimited | No auth |
| FRED | Yield spread | With API key | Optional |

## Key Architecture Decisions

1. **7D MA for Crypto** instead of 20D - faster mean-reversion for 24/7 markets
2. **Volume as 2nd indicator** - truly independent from price (unlike MA crossovers)
3. **Yield Curve for Forex** instead of RSI - RSI meaningless for FX pairs
4. **Relative Strength for Stocks** (Tier 2) - vs SPY/XLK/XLE benchmarks
5. **LLM summaries with template fallback** - never fail silently
6. **All data in `data_json` columns** - no migrations for new indicators

## Current State

### What's Working
- Full signal generation pipeline (hourly cron)
- All 3 categories generating signals
- Telegram notifications with inline buttons
- Website with real-time signal display
- MCP Server for AI agent integration
- v1 API with full indicator breakdown
- VIP waitlist funnel on all pages

### Pending / Blocked
- **Stocks Tier 2 Relative Strength**: Code ready, blocked by TwelveData rate limits (need benchmark ETF data)
- **VIP product**: Separate project (this repo is free tier only)

## File Structure Quick Reference

```
src/pages/                 # Astro pages
├── index.astro           # Homepage
├── [category]/index.astro # Category pages (crypto, forex, stocks)
├── performance.astro     # Accuracy tracking
└── api/v1/signals.ts     # Main API endpoint

worker/src/               # Signal generation worker
├── index.ts              # Cron handler
├── signals/bias.ts       # Core bias calculation
├── signals/macro.ts      # Macro context
├── data/                 # API integrations
├── skills/               # 8 skills (DAG nodes)
└── workflows/            # Category workflows

migrations/               # D1 schema (7 migrations)
mcp-server/              # MCP server for AI agents
```

## Quick Commands

```bash
# Development
npm run dev              # Start Astro dev server
npm run worker:dev       # Start worker with --test-scheduled

# Deployment
npm run deploy:prod      # Deploy frontend to production
npm run worker:deploy    # Deploy worker

# Database
npm run db:migrate:local # Apply migrations locally
npm run db:seed          # Seed test data
```

## Key Constraints

| Constraint | Value | Why It Matters |
|------------|-------|----------------|
| Workers CPU | 10ms max | Keep skills fast |
| Workers AI | 10k neurons/day | Limits LLM calls |
| Alpha Vantage | 25 req/day | Macro only, with fallbacks |
| TwelveData | 800 req/day | Batch mode essential |
| Binance IPs | Blocked | Use CoinGecko instead |

## Agent Integration Points

1. **MCP Server**: `https://everinvests-mcp.duyuefeng0708.workers.dev/mcp`
   - Tools: `get_signal`, `get_macro`, `get_history`, `get_accuracy`

2. **REST API**: `https://everinvests.com/api/v1/signals`
   - Query: `?category=crypto,forex,stocks`
   - Returns full indicator breakdown

3. **Webhooks**: Register at `/api/webhooks` (requires API key)

## What NOT to Touch

- `migrations/` - Schema is stable, changes need coordination
- `worker/src/skills/` versions - Workflow DAG depends on exact versions
- Rate limit delays in `data/` - Tuned for production limits
- `CTA_CONFIG` - Environment-controlled for launch phases

---

*For detailed implementation, see AGENT_TECHNICAL.md*
