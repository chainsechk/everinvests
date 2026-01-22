# EverInvests Technical Reference

> Detailed implementation guide for AI agents. Updated 2026-01-22.

## Table of Contents
1. [Database Schema](#database-schema)
2. [Type Definitions](#type-definitions)
3. [Signal Generation Pipeline](#signal-generation-pipeline)
4. [Data Fetching Layer](#data-fetching-layer)
5. [Bias Calculation Logic](#bias-calculation-logic)
6. [LLM Integration](#llm-integration)
7. [API Endpoints](#api-endpoints)
8. [Component Architecture](#component-architecture)
9. [Deployment & Configuration](#deployment--configuration)

---

## Database Schema

### Core Tables

```sql
-- Shared macro context (1 per time slot)
macro_signals (
  id INTEGER PRIMARY KEY,
  date TEXT,           -- '2026-01-21'
  time_slot TEXT,      -- '00:00', '08:00', etc.
  generated_at TEXT,
  dxy_bias TEXT,       -- 'strong'|'weak'|'neutral'
  vix_level TEXT,      -- 'risk_on'|'risk_off'|'neutral'
  yields_bias TEXT,    -- 'rising'|'falling'|'stable'
  overall TEXT,        -- 'Risk-on'|'Risk-off'|'Mixed'
  data_json TEXT,      -- Full macro data
  UNIQUE(date, time_slot)
)

-- Category-level signals
signals (
  id INTEGER PRIMARY KEY,
  category TEXT,       -- 'crypto'|'forex'|'stocks'
  date TEXT,
  time_slot TEXT,
  generated_at TEXT,
  bias TEXT,           -- 'Bullish'|'Bearish'|'Neutral'
  macro_id INTEGER,    -- FK to macro_signals
  data_json TEXT,      -- Levels, risks, etc.
  output_json TEXT,    -- LLM summary stored here
  UNIQUE(category, date, time_slot)
)

-- Per-asset breakdown
asset_signals (
  id INTEGER PRIMARY KEY,
  signal_id INTEGER,   -- FK to signals
  ticker TEXT,
  bias TEXT,
  price REAL,
  vs_20d_ma REAL,      -- % difference from MA
  secondary_ind TEXT,  -- RSI, funding rate, etc.
  data_json TEXT       -- Full indicators, confluence
)
```

### Observability Tables

```sql
-- Workflow execution
workflow_runs (id, workflow_id, category, date, time_slot, status, duration_ms)
skill_runs (id, workflow_run_id, skill_id, skill_version, status, duration_ms, error_msg)

-- LLM provenance
prompt_versions (id, name, version, template, created_at)
llm_runs (id, signal_id, prompt_version_id, model, tokens_in, tokens_out, latency_ms, status)

-- Accuracy tracking
signal_outcomes (id, signal_id, category, predicted_bias, price_at_signal, price_after_24h, price_change_pct, correct)
```

---

## Type Definitions

### Core Types (worker/src/types.ts)

```typescript
type Category = 'crypto' | 'forex' | 'stocks';
type Bias = 'Bullish' | 'Bearish' | 'Neutral';
type MacroOverall = 'Risk-on' | 'Risk-off' | 'Mixed' | 'Unavailable';

interface AssetData {
  ticker: string;
  price: number;
  ma20: number;
  volume: number;
  avgVolume: number;
  secondaryIndicator: number;  // RSI, funding rate, F&G
  timestamp: number;
  bbWidth?: number;
}

interface AssetSignal {
  ticker: string;
  price: number;
  bias: Bias;
  vsMA20: number;              // % difference
  volumeSignal: 'high' | 'low' | 'neutral';
  secondaryInd: string;        // Formatted value
  reasoning: string;
  indicators: {
    trend: { signal: Bias; position: string };
    volume: { signal: string; confirmation: string };
    strength: { signal: Bias; value: string; type: string };
  };
  confluence: string;          // "2/3 bullish"
  relativeStrength?: {...};    // Stocks only
}

interface MacroData {
  dxy: number;
  dxyMa20: number;
  vix: number;
  us10y: number;
  // Expanded sources
  fearGreed?: number;          // 0-100
  btcDominance?: number;
  goldPrice?: number;
  yieldSpread?: number;        // 2Y-10Y
  oilPrice?: number;
  inflationExpectation?: number;
}

interface MacroSignal {
  dxyBias: 'strong' | 'weak' | 'neutral';
  vixLevel: 'risk_on' | 'risk_off' | 'neutral';
  yieldsBias: 'rising' | 'falling' | 'stable';
  overall: MacroOverall;
  // Extended
  stressLevel?: number;        // 0-10 composite
  yieldCurve?: 'normal' | 'flat' | 'inverted';
  fearGreedSignal?: 'extreme_fear' | 'fear' | 'neutral' | 'greed' | 'extreme_greed';
  contrarian?: Bias;           // Override at extremes
  shockDetected?: boolean;
}
```

---

## Signal Generation Pipeline

### Workflow DAG (worker/src/workflows/category.ts)

```
                    ┌──────────────────┐
                    │   fetch_macro    │ v3
                    │   fetch_assets   │ v2
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
       ┌────────────┐ ┌────────────┐ ┌────────────┐
       │compute_bias│ │  quality   │ │            │
       │    v4      │ │  checks v2 │ │            │
       └─────┬──────┘ └────────────┘ └────────────┘
             │
             ▼
       ┌────────────┐
       │  generate  │
       │ summary v2 │
       └─────┬──────┘
             │
             ▼
       ┌────────────┐
       │   store    │
       │ signal v2  │
       └─────┬──────┘
             │
       ┌─────┴─────┐
       ▼           ▼
┌────────────┐ ┌────────────┐
│  notify    │ │  deliver   │
│telegram v4 │ │webhooks v1 │
└────────────┘ └────────────┘
```

### Skill Registry (worker/src/skills/index.ts)

```typescript
const SKILLS = {
  fetch_macro_data: { id: 'fetch_macro_data', version: '3', fn: fetchMacroDataSkill },
  fetch_asset_data: { id: 'fetch_asset_data', version: '2', fn: fetchAssetDataSkill },
  compute_bias: { id: 'compute_bias', version: '4', fn: computeBiasSkill },
  quality_checks: { id: 'quality_checks', version: '2', fn: qualityChecksSkill },
  generate_summary: { id: 'generate_summary', version: '2', fn: generateSummarySkill },
  store_signal: { id: 'store_signal', version: '2', fn: storeSignalSkill },
  notify_telegram: { id: 'notify_telegram', version: '4', fn: notifyTelegramSkill },
  deliver_webhooks: { id: 'deliver_webhooks', version: '1', fn: deliverWebhooksSkill },
};
```

---

## Data Fetching Layer

### Crypto (worker/src/data/binance.ts)

```typescript
// PRIMARY: CoinGecko API (30-day market chart)
const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=30`;

// Returns: prices[], total_volumes[]
// Calculate MA7 (not MA20 - faster for 24/7 markets)
// Calculate Bollinger Band Width

// FALLBACK: CoinCap API (more permissive with cloud IPs)
const url = `https://api.coincap.io/v2/assets/${assetId}/history?interval=d1`;

// SECONDARY: Binance Futures funding rate (often blocked)
const url = `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}USDT&limit=1`;
```

### Forex/Stocks (worker/src/data/twelvedata.ts)

```typescript
// BATCH MODE - reduces API calls significantly
// Quote endpoint (last price)
const quoteUrl = `https://api.twelvedata.com/quote?symbol=${symbols.join(',')}&apikey=${key}`;

// Time series (for MA20, volume)
const tsUrl = `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=1day&outputsize=30`;

// RSI (for strength indicator)
const rsiUrl = `https://api.twelvedata.com/rsi?symbol=${symbol}&interval=1day&time_period=14`;
```

### Macro (worker/src/data/alphavantage.ts)

```typescript
// DXY, VIX via Yahoo Finance (direct index, not ETF proxy)
const dxyUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?interval=1d&range=30d';
const vixUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=1d';

// 10Y Yield via Alpha Vantage
const yieldUrl = `https://www.alphavantage.co/query?function=TREASURY_YIELD&interval=daily&maturity=10year&apikey=${key}`;

// Fear & Greed via Alternative.me (free, no auth)
const fgUrl = 'https://api.alternative.me/fng/?limit=1';

// Yield Spread via FRED (optional)
const spreadUrl = `https://api.stlouisfed.org/fred/series/observations?series_id=T10Y2Y&api_key=${key}`;
```

---

## Bias Calculation Logic

### File: worker/src/signals/bias.ts

```typescript
function calculateAssetBias(asset: AssetData, category: Category, macro: MacroSignal): AssetSignal {
  // INDICATOR 1: Trend (Price vs MA20)
  const vsMA = ((asset.price - asset.ma20) / asset.ma20) * 100;
  const trendSignal = vsMA > 1 ? 'Bullish' : vsMA < -1 ? 'Bearish' : 'Neutral';

  // INDICATOR 2: Volume (Truly independent!)
  const volRatio = asset.volume / asset.avgVolume;
  let volumeSignal: 'high' | 'low' | 'neutral';
  if (volRatio > 1.2) volumeSignal = 'high';      // Confirms trend
  else if (volRatio < 0.8) volumeSignal = 'low';  // Diverges
  else volumeSignal = 'neutral';

  // INDICATOR 3: Strength (Asset-class specific)
  let strengthSignal: Bias;
  switch (category) {
    case 'crypto':
      // Fear & Greed (contrarian)
      const fg = macro.fearGreed ?? 50;
      strengthSignal = fg < 30 ? 'Bullish' : fg > 70 ? 'Bearish' : 'Neutral';
      break;
    case 'forex':
      // Yield Curve
      strengthSignal = macro.yieldCurve === 'normal' ? 'Bullish'
                     : macro.yieldCurve === 'inverted' ? 'Bearish' : 'Neutral';
      break;
    case 'stocks':
      // RSI
      const rsi = asset.secondaryIndicator;
      strengthSignal = rsi < 30 ? 'Bullish' : rsi > 70 ? 'Bearish' : 'Neutral';
      break;
  }

  // CONFLUENCE: 2 of 3 wins
  const bullish = [trendSignal, volumeConfirmation, strengthSignal].filter(s => s === 'Bullish').length;
  const bearish = [trendSignal, volumeConfirmation, strengthSignal].filter(s => s === 'Bearish').length;

  const bias = bullish >= 2 ? 'Bullish' : bearish >= 2 ? 'Bearish' : 'Neutral';

  return {
    ticker: asset.ticker,
    bias,
    confluence: `${Math.max(bullish, bearish)}/3 ${bias.toLowerCase()}`,
    indicators: { trend: {...}, volume: {...}, strength: {...} }
  };
}

function calculateCategoryBias(assets: AssetSignal[], macro: MacroSignal): Bias {
  // Majority vote
  const bullish = assets.filter(a => a.bias === 'Bullish').length;
  const bearish = assets.filter(a => a.bias === 'Bearish').length;

  // Contrarian override from F&G extremes
  if (macro.contrarian) {
    // Extreme fear → flip bearish to neutral, neutral to bullish
    // Extreme greed → flip bullish to neutral, neutral to bearish
  }

  return bullish > bearish ? 'Bullish' : bearish > bullish ? 'Bearish' : 'Neutral';
}
```

### Stocks Tier 2: Relative Strength (worker/src/signals/bias.ts)

```typescript
// 4-indicator model for stocks (when benchmark data available)
interface RelativeStrength {
  vsSPY: number;      // ratio vs S&P 500
  vsSector: number;   // ratio vs sector ETF (XLK or XLE)
  spySignal: 'outperform' | 'underperform' | 'neutral';
  sectorSignal: 'outperform' | 'underperform' | 'neutral';
}

// Thresholds: >1.02 = outperform, <0.98 = underperform
// Need 3+ of 4 signals for direction (trend, volume, RSI, RS)
```

---

## LLM Integration

### File: worker/src/llm/summary.ts

```typescript
async function generateSummary(signal: CategorySignal, env: Env): Promise<SummaryResult> {
  // Route by category
  const model = signal.category === 'stocks'
    ? 'openrouter/deepseek-v3'  // Larger model for complex stocks
    : 'workers-ai/llama-3.1-8b'; // Smaller for crypto/forex

  const prompt = buildPrompt(signal);

  try {
    const response = await callLLM(model, prompt, env);
    const summary = validateAndSanitize(response);
    return { summary, model, tokens: response.usage };
  } catch (error) {
    // Template fallback - never fail
    return {
      summary: `${signal.category} signals ${signal.bias}. ${signal.assets.length} assets analyzed.`,
      model: 'template',
      fallback: true
    };
  }
}
```

### Prompt Template (worker/src/llm/prompts.ts)

```typescript
const PROMPTS = {
  'signal_summary@1': `
You are a financial analyst writing a brief market signal summary.

Category: {{category}}
Overall Bias: {{bias}}
Macro Environment: {{macro.overall}}

Assets:
{{#each assets}}
- {{ticker}}: {{bias}} ({{confluence}})
{{/each}}

Key Levels: {{levels}}
Risks: {{risks}}

Write a 1-2 sentence summary focusing on the key driver of the signal.
Do not use emojis. Keep it professional and concise.
`
};
```

---

## API Endpoints

### GET /api/v1/signals

```typescript
// File: src/pages/api/v1/signals.ts
// Query: ?category=crypto,forex,stocks (comma-separated)

interface SignalResponse {
  version: "1.0";
  generated_at: string;
  macro: {
    overall: MacroOverall;
    dxy: { value: number; bias: string };
    vix: { value: number; level: string };
    yields: { value: number; bias: string };
    fearGreed?: { value: number; signal: string };
  };
  signals: {
    [category: string]: {
      bias: Bias;
      summary: string;
      levels: string;
      risks: string[];
      assets: {
        ticker: string;
        bias: Bias;
        price: number;
        indicators: {
          trend: { signal: string; position: string };
          volume: { signal: string; confirmation: string };
          strength: { signal: string; value: string; type: string };
        };
        confluence: string;
      }[];
    };
  };
  _links: {
    mcp: string;
    rss: string;
    telegram: string;
  };
}
```

### MCP Server Tools

```typescript
// File: mcp-server/src/index.ts
// URL: https://everinvests-mcp.duyuefeng0708.workers.dev/mcp

tools: [
  { name: 'get_signal', description: 'Get latest signal for category', input: { category: string } },
  { name: 'get_macro', description: 'Get current macro context' },
  { name: 'get_history', description: 'Get recent signals', input: { category: string, limit?: number } },
  { name: 'get_accuracy', description: 'Get 30-day accuracy stats', input: { category: string } },
]

resources: [
  { uri: 'everinvests://categories', description: 'Available categories and schedules' }
]
```

---

## Component Architecture

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| MacroBar | `src/components/MacroBar.astro` | Displays macro indicators with InfoTips and ScaleBars |
| AssetTable | `src/components/AssetTable.astro` | Per-asset signals with 3-indicator breakdown |
| SignalCard | `src/components/SignalCard.astro` | Summary card for category |
| SignalDetail | `src/components/SignalDetail.astro` | Full signal detail |
| BiasIndicator | `src/components/BiasIndicator.astro` | Visual bias badge |
| InfoTip | `src/components/InfoTip.astro` | Hover tooltip for explanations |
| ScaleBar | `src/components/ScaleBar.astro` | Visual 0-100 gauge |
| VIPCTA | `src/components/VIPCTA.astro` | VIP waitlist CTA |
| ThemeToggle | `src/components/ThemeToggle.astro` | Light/dark mode |

### Data Flow: Page → Component

```typescript
// Category page (e.g., src/pages/crypto/index.astro)
const signal = await getLatestSignal(db, 'crypto');
const assets = await getAssetSignals(db, signal.id);
const macro = await getMacroSignal(db, signal.macro_id);

// Parse JSON columns
const outputData = JSON.parse(signal.output_json);
const macroData = JSON.parse(macro.data_json);

// Pass to components
<MacroBar signal={macro} dataJson={macroData} />
<SignalDetail signal={signal} summary={outputData.summary} />
<AssetTable assets={assets} category="crypto" />
```

---

## Deployment & Configuration

### Environment Variables

```toml
# worker/wrangler.toml
[vars]
VIP_CTA_MODE = "waitlist"  # 'waitlist' | 'live' | 'none'

# Secrets (via wrangler secret put)
TWELVEDATA_API_KEY
ALPHAVANTAGE_API_KEY
OPENROUTER_API_KEY
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
WEBHOOK_API_KEY          # For webhook API auth
FRED_API_KEY             # Optional, for yield spread
```

### Deployment Commands

```bash
# Frontend (Astro → Cloudflare Pages)
npm run build
npm run deploy:prod      # --branch main
npm run deploy:preview   # --branch dev

# Worker (Signal generation)
cd worker
npm run deploy

# MCP Server
cd mcp-server
npm run deploy

# Database
npm run db:migrate:local    # Local testing
wrangler d1 migrations apply everinvests-db  # Production
```

### URLs

| Service | URL |
|---------|-----|
| Production | https://everinvests.com |
| API v1 | https://everinvests.com/api/v1/signals |
| MCP | https://everinvests-mcp.duyuefeng0708.workers.dev/mcp |
| Worker | https://everinvests-worker.duyuefeng0708.workers.dev |

---

## Code Patterns

### Reading Signals from D1

```typescript
// src/lib/db/queries.ts
const signal = await db.prepare(`
  SELECT s.*, m.overall as macro_overall
  FROM signals s
  LEFT JOIN macro_signals m ON s.macro_id = m.id
  WHERE s.category = ?
  ORDER BY s.generated_at DESC
  LIMIT 1
`).bind(category).first();

// Parse JSON columns
const output = JSON.parse(signal.output_json || '{}');
const summary = output.summary || 'No summary available';
```

### Caching Pattern

```typescript
// worker/src/cache/ttl.ts
async function cachedFetch<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<CacheResult<T>> {
  const cache = caches.default;
  const cacheKey = new Request(`https://cache.internal/${key}`);

  const cached = await cache.match(cacheKey);
  if (cached) {
    const data = await cached.json();
    const age = Date.now() - data.timestamp;
    return { data: data.value, cached: true, stale: age > ttl * 1000 };
  }

  const fresh = await fetcher();
  await cache.put(cacheKey, new Response(JSON.stringify({ value: fresh, timestamp: Date.now() })));
  return { data: fresh, cached: false, stale: false };
}
```

### Error Handling Pattern

```typescript
// worker/src/skills/fetchAssetData.ts
export async function fetchAssetDataSkill(ctx: SkillContext): Promise<SkillResult> {
  const results: AssetData[] = [];
  const errors: string[] = [];

  for (const ticker of ctx.input.tickers) {
    try {
      const data = await fetchWithRetry(ticker, ctx.env);
      results.push(data);
    } catch (e) {
      errors.push(`${ticker}: ${e.message}`);
      // Continue with other tickers - partial success is OK
    }
  }

  if (results.length === 0) {
    throw new Error(`All tickers failed: ${errors.join(', ')}`);
  }

  return {
    assetData: results,
    missingTickers: errors.map(e => e.split(':')[0]),
    warnings: errors.length > 0 ? errors : undefined,
  };
}
```

---

*For high-level overview, see AGENT_BRIEF.md*
