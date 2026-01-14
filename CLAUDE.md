# EverInvests

Market signal broadcast site. Daily automated signals for Crypto, Forex, Stocks → Telegram funnel.

## Stack
- **Framework:** Astro (SSR on Cloudflare Pages)
- **Compute:** Cloudflare Workers (signal generation + API)
- **Database:** Cloudflare D1 (SQLite)
- **LLM:** Workers AI (Llama 3.1 8B) for crypto/forex; DeepSeek V3 via OpenRouter for stocks
- **Scheduling:** Single hourly Cron Trigger with smart routing

## Assets & Schedule (UTC)
| Category | Assets | Updates |
|----------|--------|---------|
| Crypto | BTC, ETH | 00:00, 08:00, 16:00 |
| Forex | USD/JPY, EUR/USD, USD/CAD, USD/AUD | 00:00, 08:00, 14:00 (weekdays) |
| Stocks | 25 tickers (semis, AI infra, energy) | 17:00, 21:00 (weekdays) |

## Signal Logic
1. **Macro context:** DXY vs 20D MA, VIX level, US 10Y → Risk-on/Risk-off/Mixed
2. **Per-asset:** Price vs 20D MA + secondary indicator (funding rate/RSI/rel strength)
3. **Scoring:** 2 bullish = Bullish, 2 bearish = Bearish, else Neutral
4. **LLM:** Generates 1-2 sentence summary from bias + levels

## Data Sources
- **Crypto:** Binance API (price, funding)
- **Forex/Stocks:** Twelve Data (800 req/day free)
- **Macro:** Alpha Vantage (25 req/day free)

## Key Files (planned)
```
src/pages/           # Astro pages (/, /crypto, /forex, /stocks, /about)
src/pages/api/       # API endpoints
functions/           # Cloudflare Workers (signal generation)
```

## DB Tables
- `macro_signals` - shared macro context per time slot
- `signals` - category-level signals with output JSON
- `asset_signals` - per-ticker breakdown
- `run_logs` - observability

## Constraints
- Workers CPU: 10ms/invocation (keep simple)
- Workers AI: 10k neurons/day
- Alpha Vantage: 25 req/day (macro only)
- No user accounts, no user queries, daily signals only
