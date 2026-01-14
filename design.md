# EverInvests Design Document

**Date:** 2026-01-14
**Status:** Validated
**Version:** 1.0

---

## 1. Overview & Goals

**EverInvests** is a free market signal broadcast site that generates daily automated signals across three asset categories: Crypto, Forex, and Stocks. The site serves as a discoverable archive and credibility layer, funneling users to premium Telegram channels.

### Goals
- Automated daily signals (no user prompting)
- Fixed-format output for easy scanning/sharing
- Historical archive with timestamps for trust
- Drive traffic to Telegram (primary engagement)

### Non-Goals (MVP)
- No user accounts/logins
- No user-initiated queries
- No paywall on website
- No intraday signals (daily only due to free tier constraints)

### Target Users
- Retail traders seeking quick daily context
- Telegram members wanting an archive
- SEO discoverers searching for market summaries

---

## 2. Asset Coverage & Signal Structure

### Three Categories

| Category | Assets | Updates (UTC) |
|----------|--------|---------------|
| Crypto | BTC, ETH | 00:00, 08:00, 16:00 (3x daily) |
| Forex | USD/JPY, EUR/USD, USD/CAD, USD/AUD | 00:00, 08:00, 14:00 (3x weekdays) |
| Stocks | 25 tickers | 17:00, 21:00 (2x weekdays) |

### Stock Tickers (25)

**Semiconductors (10):**
NVDA, AMD, INTC, AVGO, TSM, ASML, QCOM, MU, MRVL, ARM

**AI Infrastructure (9):**
MSFT, GOOGL, META, AMZN, ORCL, CRWV, CRM, SNOW, PLTR

**Energy/Power (6):**
VST, CEG, NRG, CCJ, SMR, OKLO

### Signal Output Format

```
- Macro Context: Risk-on / Risk-off / Mixed
- Bias: Bullish / Neutral / Bearish
- Key Levels: Support/Resistance ranges
- Triggers: "If X breaks Y, then Z"
- Risks: 1-2 bullet points
- Summary: 1-2 sentence LLM-generated summary
- Timestamp: "Generated at HH:00 UTC"
```

---

## 3. Signal Generation Logic

### Hybrid Approach
Rule-based bias calculation + LLM-generated summaries.

### Shared Macro Module

| Indicator | Bullish | Bearish |
|-----------|---------|---------|
| DXY vs 20D MA | Below | Above |
| VIX level | <20 | >25 |
| US 10Y trend | Falling | Rising |

**Output:** Risk-on / Risk-off / Mixed

### Per-Category Indicators

| Category | Indicator 1 | Indicator 2 |
|----------|-------------|-------------|
| Crypto | Price vs 20D MA | Funding rate (<0.01% bullish, >0.05% bearish) |
| Forex | Price vs 20D MA | RSI(14) (>70 overbought, <30 oversold) |
| Stocks | Price vs 20D MA | Sector vs SPY relative strength |

### Scoring Logic
- 2 bullish indicators = Bullish
- 2 bearish indicators = Bearish
- Mixed = Neutral

### Macro Overlay
- Risk-on + Bullish signal → "Bullish"
- Risk-off + Bullish signal → "Bullish with caution"
- Risk-on + Bearish signal → "Bearish but watch for reversal"
- Risk-off + Bearish signal → "Bearish"

### LLM Layer
- **Primary:** Cloudflare Workers AI (Llama 3.1 8B) for crypto/forex
- **Fallback:** DeepSeek V3 via OpenRouter for stocks (token-heavy)
- Input: Bias, key levels, indicator values
- Output: 1-2 sentence human-readable summary + risk notes

---

## 4. Tech Stack & Architecture

### Stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Framework | Astro | Content-focused, great SEO, native CF adapter |
| Database | Cloudflare D1 | SQLite at edge, free tier sufficient |
| Compute | Cloudflare Workers | API endpoints + signal generation |
| LLM (primary) | Cloudflare Workers AI | Free, native integration |
| LLM (fallback) | DeepSeek V3 / OpenRouter | For stocks, ~$0.003/day |
| Scheduling | Cloudflare Cron Trigger | Single hourly trigger with smart routing |
| Hosting | Cloudflare Pages | everinvests.com |

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                     Cloudflare Platform                          │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │ Cron Trigger│───▶│   Worker    │───▶│   Workers AI        │  │
│  │ (hourly)    │    │ (router +   │    │   (Llama 3.1)       │  │
│  └─────────────┘    │  generator) │    └─────────────────────┘  │
│                     └──────┬──────┘              │               │
│                            │                     │ fallback      │
│         ┌──────────────────┼─────────────────────┼───────┐       │
│         ▼                  ▼                     ▼       │       │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │       │
│  │  D1 (data)  │    │ Telegram Bot│    │ DeepSeek V3 │   │       │
│  │             │    │   API       │    │ (OpenRouter)│   │       │
│  └─────────────┘    └─────────────┘    └─────────────┘   │       │
│         ▲                                                │       │
│         │                            ┌───────────────────┘       │
│  ┌─────────────┐    ┌────────────────▼────────────────┐         │
│  │ Pages       │───▶│ Astro SSR (site)                │         │
│  │ (hosting)   │    │ /, /crypto, /forex, /stocks     │         │
│  └─────────────┘    └─────────────────────────────────┘         │
│                                                                  │
│                     ┌─────────────────────────────────┐         │
│                     │ External Data APIs              │         │
│                     │ Binance, Twelve Data, etc.      │         │
│                     └─────────────────────────────────┘         │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow
1. Cron triggers Worker hourly
2. Worker checks schedule, runs appropriate signals
3. Worker fetches data from external APIs (Binance, Twelve Data, etc.)
4. Worker calculates bias via rules
5. Worker calls Workers AI (or DeepSeek for stocks) for summary
6. Worker saves to D1 + posts to Telegram
7. Astro site reads from D1, renders pages

---

## 5. Database Schema

```sql
-- Shared macro context (generated per scheduled time)
CREATE TABLE macro_signals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  date          TEXT NOT NULL,           -- '2026-01-14'
  time_slot     TEXT NOT NULL,           -- '08:00'
  generated_at  TEXT NOT NULL,
  dxy_bias      TEXT,                    -- 'strong' | 'weak' | 'neutral'
  vix_level     TEXT,                    -- 'risk_on' | 'risk_off' | 'neutral'
  yields_bias   TEXT,                    -- 'rising' | 'falling' | 'stable'
  overall       TEXT,                    -- 'Risk-on' | 'Risk-off' | 'Mixed'
  data_json     TEXT,
  UNIQUE(date, time_slot)
);

-- Category-level signals
CREATE TABLE signals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  category      TEXT NOT NULL,           -- 'crypto' | 'forex' | 'stocks'
  date          TEXT NOT NULL,
  time_slot     TEXT NOT NULL,           -- '08:00'
  generated_at  TEXT NOT NULL,
  bias          TEXT NOT NULL,
  macro_id      INTEGER REFERENCES macro_signals(id),
  data_json     TEXT,
  output_json   TEXT,                    -- levels, triggers, risks, summary
  UNIQUE(category, date, time_slot)
);

-- Per-asset breakdown
CREATE TABLE asset_signals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  signal_id     INTEGER NOT NULL REFERENCES signals(id),
  ticker        TEXT NOT NULL,
  bias          TEXT,
  price         REAL,
  vs_20d_ma     TEXT,                    -- 'above' | 'below'
  secondary_ind TEXT,                    -- funding rate / RSI / rel strength
  data_json     TEXT
);

-- Run logs for observability
CREATE TABLE run_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  category      TEXT,
  time_slot     TEXT,
  run_at        TEXT NOT NULL,
  status        TEXT NOT NULL,           -- 'success' | 'failed'
  duration_ms   INTEGER,
  error_msg     TEXT
);

-- Indexes for common queries
CREATE INDEX idx_signals_category_date ON signals(category, date);
CREATE INDEX idx_asset_signals_ticker ON asset_signals(ticker);
CREATE INDEX idx_macro_date ON macro_signals(date);
```

---

## 6. Frontend Structure

### Page Structure (Astro)

```
src/pages/
├── index.astro              → Home (overview of all 3 categories)
├── about.astro              → Methodology + Telegram CTA
├── crypto/
│   ├── index.astro          → Today's crypto signal + last 7 days
│   ├── history.astro        → Full archive
│   └── [ticker].astro       → BTC or ETH detail (future)
├── forex/
│   ├── index.astro          → Today's forex signal + last 7 days
│   ├── history.astro        → Full archive
│   └── [pair].astro         → Individual pair (future)
├── stocks/
│   ├── index.astro          → Today's stocks signal + last 7 days
│   ├── history.astro        → Full archive
│   └── [ticker].astro       → Individual stock (e.g., /stocks/NVDA)
└── api/
    ├── today/[category].ts  → GET latest signal
    └── history/[category].ts → GET historical signals
```

### Home Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│  EverInvests          [Crypto] [Forex] [Stocks] [About]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  MACRO: Risk-On  |  DXY weak  |  VIX 18  |  Yields ↓  │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   CRYPTO    │  │    FOREX    │  │   STOCKS    │         │
│  │             │  │             │  │             │         │
│  │  Bullish ▲  │  │  Neutral ─  │  │  Bearish ▼  │         │
│  │             │  │             │  │             │         │
│  │  BTC, ETH   │  │  4 pairs    │  │  25 tickers │         │
│  │  holding    │  │  mixed      │  │  under      │         │
│  │  above MA   │  │  signals    │  │  pressure   │         │
│  │             │  │             │  │             │         │
│  │  [View →]   │  │  [View →]   │  │  [View →]   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  📱 Join Telegram                                     │  │
│  │                                                       │  │
│  │  🔔 Real-time notifications when signals update       │  │
│  │  💎 Premium insights for serious traders              │  │
│  │                                                       │  │
│  │  [Join Free Channel →]    [Explore Premium →]         │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  Updated: 08:00 UTC  •  Next update: 14:00 UTC             │
└─────────────────────────────────────────────────────────────┘
```

### Category Page Shows
- Current signal (full detail: bias, levels, triggers, risks, summary)
- Macro context
- Per-asset breakdown table
- Last 7 days mini-cards
- Link to full history
- Telegram CTA

---

## 7. Telegram Integration

### Two-Tier Setup

| Channel | Purpose | Content |
|---------|---------|---------|
| **Free Public Channel** | Notifications + funnel | Auto-posted signal summaries |
| **Premium Group** | Monetization | Full hedge-fund-grade analysis |

### Auto-Post Format (Free Channel)

```
📊 CRYPTO SIGNAL | 2026-01-14 08:00 UTC

Macro: Risk-On 🟢
Bias: Bullish ▲

BTC: $98,500 (above 20D MA)
ETH: $3,850 (above 20D MA)

Key Level: Break above $100k → momentum accelerates
Risk: Funding elevated, watch for squeeze

Summary: Consolidation continues with bullish lean.
Watch $100k breakout.

🔗 Full details: everinvests.com/crypto
💎 Premium analysis: t.me/everinvests_premium
```

### Implementation
- Worker calls Telegram Bot API after saving signal to D1
- Bot token stored in Workers secrets
- One message per category per update

---

## 8. Constraints & Limitations

### Free Tier Limits

| Resource | Limit | Our Usage | Status |
|----------|-------|-----------|--------|
| Cloudflare Workers | 100k requests/day | ~50/day | ✓ Plenty |
| Workers CPU | 10ms/invocation | ~5-8ms | ✓ Tight but OK |
| Workers AI | 10k neurons/day | ~6k (crypto+forex) | ✓ OK |
| D1 reads | 5M rows/day | ~1k/day | ✓ Plenty |
| D1 writes | 100k rows/day | ~100/day | ✓ Plenty |
| D1 storage | 5GB | ~10MB/year | ✓ Plenty |
| Cron triggers | 5 per account | 1 (hourly) | ✓ OK |
| Twelve Data API | 800 requests/day | ~100/day | ✓ OK |
| Alpha Vantage | 25 requests/day | ~10/day (macro) | ⚠ Tight |

### Architectural Constraints & Mitigations

| Constraint | Mitigation |
|------------|------------|
| Workers AI token limit | Use DeepSeek V3 for stocks signals |
| 10ms CPU limit | Keep processing simple, offload to AI |
| Alpha Vantage 25/day | Use only for macro indicators (DXY, VIX) |
| No real-time data | Daily/multi-daily is the product |

### Explicit Non-Goals (MVP)

- User accounts / authentication
- User-initiated queries
- Intraday signals (hourly or faster)
- Historical backtesting
- Price predictions or targets
- Mobile app

### Upgrade Triggers

| Trigger | Upgrade Path | Cost |
|---------|--------------|------|
| Need >10ms CPU | Workers Paid | $5/mo |
| Need more API calls | Twelve Data paid | $29/mo |
| Need faster updates | More cron + higher limits | Variable |
| Workers AI insufficient | DeepSeek/OpenRouter only | ~$1/mo |

---

## 9. Data Sources

### Crypto (BTC, ETH)
- **Binance API** (free, generous limits)
  - Price, volume, 20D MA
  - Funding rates
  - Open interest (optional)

### Forex (4 pairs)
- **Twelve Data** (free tier: 800/day)
  - Price, 20D MA
  - RSI(14)

### Stocks (25 tickers)
- **Twelve Data** (free tier: 800/day)
  - Price, 20D MA
  - Relative strength vs SPY

### Macro
- **Alpha Vantage** (free tier: 25/day)
  - DXY
  - VIX
  - US 10Y yield

---

## 10. Future Roadmap

### Phase 1: MVP (Current Design)
- 3 categories, 2-3 updates/day
- Basic indicators, rule-based bias + LLM summaries
- Free Telegram channel with auto-posts
- Static site with history archive

### Phase 2: Enhanced Free Tier
- Individual ticker pages (/stocks/NVDA) for SEO
- Email signup for daily digest
- Social sharing (Twitter/X cards)
- Basic analytics (page views, Telegram joins)

### Phase 3: Premium Monetization
- Premium Telegram bot with paid subscription
- Full hedge-fund-grade analysis (5-module framework)
- Multiple updates per day for premium
- Custom alerts on level breaks

### Phase 4: Scale
- More asset classes (commodities, bonds)
- User accounts + personalized watchlists
- API access for developers
- Mobile app

---

## 11. Summary

| Aspect | Decision |
|--------|----------|
| **Assets** | Crypto (BTC, ETH), Forex (4 pairs), Stocks (25 tickers) |
| **Updates** | Crypto 3x, Forex 3x, Stocks 2x daily |
| **Stack** | Astro + Cloudflare Pages/Workers/D1 |
| **LLM** | Workers AI (crypto/forex) + DeepSeek V3 (stocks) |
| **Cron** | Single hourly trigger with smart routing |
| **Telegram** | Free channel (auto-post) + Premium upsell |
| **Cost** | ~$0.10/month (DeepSeek only) |

---

*Document generated: 2026-01-14*
