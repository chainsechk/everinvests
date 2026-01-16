# Local Development Guide

## Prerequisites

- Node.js 20+ (use nvm: `nvm install --lts`)
- npm (comes with Node.js)
- Wrangler CLI (`npm install -g wrangler`)
- Logged into Cloudflare (`wrangler login`)

## First-Time Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <repo>
   cd everinvests
   npm install
   cd worker && npm install && cd ..
   ```

2. **Apply migrations to local D1:**
   ```bash
   npm run db:migrate:local
   ```

3. **Seed local database:**
   ```bash
   npm run db:seed
   ```

4. **Set up worker secrets (for production):**
   ```bash
   cd worker
   wrangler secret put TELEGRAM_BOT_TOKEN
   wrangler secret put TELEGRAM_CHAT_ID
   wrangler secret put TWELVEDATA_API_KEY
   wrangler secret put ALPHAVANTAGE_API_KEY
   wrangler secret put OPENROUTER_API_KEY
   ```

## Daily Development

### Running the Astro site

```bash
# Option 1: Astro dev (fast, no D1)
npm run dev

# Option 2: With local D1 (requires build first)
npm run build && npm run dev:wrangler
```

### Running the Worker locally

```bash
npm run worker:dev

# Trigger scheduled job manually:
curl "http://127.0.0.1:8787/__scheduled?cron=0+*+*+*+*"

# Or trigger specific category:
curl "http://127.0.0.1:8787/trigger?category=crypto"
```

### Testing

```bash
npm test           # Run once
npm run test:watch # Watch mode
```

### Database Commands

```bash
# Apply migrations
npm run db:migrate:local   # Local D1
npm run db:migrate:remote  # Production D1

# Seed data (local only)
npm run db:seed

# Query local database
wrangler d1 execute everinvests-db --local --command "SELECT * FROM signals;"

# Query production database
wrangler d1 execute everinvests-db --remote --command "SELECT * FROM signals;"
```

## Deployment

### Deploy Astro site (Pages)

```bash
npm run deploy
# Or use Git integration (push to main)
```

### Deploy Worker

```bash
npm run worker:deploy
```

### Bind D1 in Dashboard

For Pages: Workers & Pages → everinvests-site → Settings → Functions → D1 bindings → Add `DB`

## Canonical Domain

- The site canonical/OG URLs come from `astro.config.mjs` via `site: "https://everinvests.com"`.
- The Worker uses `SITE_URL` (optional) to build links in Telegram notifications; it defaults to `https://everinvests.com`.

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/today/{category}` | Latest signal for crypto/forex/stocks |
| `GET /api/history/{category}?limit=N` | Historical signals (default 7, max 30) |
| `GET /api/macro` | Latest macro context |

## Observability Tables

The Worker writes workflow observability into D1:

- `workflow_runs`: one row per category run
- `skill_runs`: one row per skill execution within a workflow

## Project Structure

```
everinvests/
├── src/
│   ├── pages/           # Astro pages
│   │   └── api/         # API routes
│   └── lib/db/          # D1 query layer
├── worker/              # Signal generation worker
│   ├── src/index.ts     # Worker entry point
│   ├── src/pipeline.ts  # Workflow orchestrator
│   ├── src/skills/      # Modular skills
│   └── src/workflows/   # Per-category workflows
├── migrations/          # D1 schema
├── scripts/             # Development scripts
└── tests/               # Vitest tests
```

## Important Notes

1. **Pages local dev cannot connect to remote D1** - this is a Cloudflare limitation. Use Preview deployments to test with real data.

2. **Cron changes take up to 15 minutes to propagate** after deployment.

3. **Workers AI binding** for Pages must be configured in the Cloudflare dashboard, not wrangler.toml.

4. **Signal schedule (UTC):**
   - Crypto: 00:00, 08:00, 16:00 (daily)
   - Forex: 00:00, 08:00, 14:00 (weekdays)
   - Stocks: 17:00, 21:00 (weekdays)
