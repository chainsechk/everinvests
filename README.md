# EverInvests

Market signal broadcast site. Daily automated signals for Crypto, Forex, Stocks → Telegram funnel.

## Stack

- **Framework:** Astro (SSR on Cloudflare Pages)
- **Compute:** Cloudflare Workers (signal generation + API)
- **Database:** Cloudflare D1 (SQLite)
- **LLM:** Workers AI (Llama 3.1 8B) for crypto/forex; DeepSeek V3 via OpenRouter for stocks

## Assets & Schedule (UTC)

| Category | Assets | Updates |
|----------|--------|---------|
| Crypto | BTC, ETH | 00:00, 08:00, 16:00 |
| Forex | USD/JPY, EUR/USD, USD/CAD, AUD/USD | 00:00, 08:00, 14:00 (weekdays) |
| Stocks | Key tickers (semis, AI infra, energy) | 17:00, 21:00 (weekdays) |

## API Endpoints

```
GET /api/today/{category}      # Latest signal for crypto|forex|stocks
GET /api/history/{category}    # Historical signals (default 7, max 30)
GET /api/macro                 # Latest macro context (DXY, VIX, yields)
```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Local dev (no D1)
npm run dev

# Local dev with D1
npm run build && npm run dev:wrangler

# Apply D1 migrations
npm run db:migrate:local
npm run db:migrate:remote
```

## Project Structure

```
src/
  pages/           # Astro pages and API routes
  lib/db/          # D1 query layer
migrations/        # D1 schema migrations
worker/            # Signal generation worker
```

## License

MIT
