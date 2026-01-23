# Findings & Decisions

## Top 3 News (GDELT Headlines) Integration (2026-01-23)

### System Architecture

The "top 3 news" feature is part of the GDELT (Global Database of Events, Language, and Tone) integration. Here's the complete data flow:

```
GDELT API → Worker Cron → D1 Database → Macro Signal → MacroBar UI
```

### 1. Data Fetching (`worker/src/data/gdelt.ts`)

**Schedule:** Every 6 hours at 01:00, 07:00, 13:00, 19:00 UTC

**Process:**
1. Queries GDELT DOC 2.0 API for keywords: "war", "military conflict", "sanctions", "tariffs", "trade war", "crisis", "invasion", "nuclear", "terrorism", "coup"
2. Retrieves up to 250 articles from last 24h, sorted by `hybridrel` (relevance + recency)
3. Extracts **top 3 headlines** from first 3 articles (most relevant)
4. Calculates **spike ratio** = current articles / 7-day average articles
5. Returns `GdeltResult` with:
   - `score`: 0-100 tension score
   - `topHeadlines`: `[{ title, url }, ...]`
   - `spikeRatio`: e.g., 2.5 = 2.5x normal activity

### 2. Storage (`worker/src/storage/d1.ts` + migration 0007)

**Table:** `gdelt_scores`
```sql
ALTER TABLE gdelt_scores ADD COLUMN top_headlines TEXT DEFAULT '[]';
ALTER TABLE gdelt_scores ADD COLUMN spike_ratio REAL DEFAULT 1.0;
```

**Functions:**
- `saveGdeltScore()` - Stores headlines as JSON string
- `getPreviousGdeltScore()` - For trend calculation
- `getGdelt7DayAvgArticles()` - For spike detection baseline

### 3. Regime Classification (`worker/src/signals/regime.ts`)

**Function:** `classifyRegimePhase4()`

Maps GDELT score to regime:
| Score | Regime | Signal Dampening |
|-------|--------|------------------|
| 70+ | critical | 40% (heavy reduction) |
| 50-69 | high | 70% |
| 30-49 | elevated | 90% |
| 0-29 | calm | 100% (no reduction) |

Headlines and spike ratio are passed through to the regime data.

### 4. Macro Signal Storage

The regime classification (including phase4_gdelt with headlines) is stored in `macro_signals.data_json` and flows to the frontend.

### 5. Frontend Display (`src/components/MacroBar.astro`)

**Trigger:** Headlines display when:
- `regime.phase4_gdelt` exists AND
- `getGdeltRegimeAlert()` returns non-null (regime is elevated/high/critical) AND
- `topHeadlines.length > 0`

**UI:**
```html
<!-- Shows when geopolitical risk is elevated+ -->
<div class="flex items-center gap-2">
  ⚠ High Geopolitical Risk | Score 52 (2.1x normal)
</div>
<div class="mt-3 pl-8">
  <span>Top Stories:</span>
  <ul>
    <li>→ US imposes new tariffs on...</li>
    <li>→ Military buildup reported in...</li>
    <li>→ Emergency sanctions announced...</li>
  </ul>
</div>
```

### Key Files Summary

| File | Purpose |
|------|---------|
| `worker/src/data/gdelt.ts` | GDELT API fetcher, extracts top 3 headlines |
| `worker/src/index.ts:63-69` | Cron schedule (every 6h) |
| `worker/src/storage/d1.ts` | `saveGdeltScore()`, `getGdelt7DayAvgArticles()` |
| `worker/src/signals/regime.ts` | `classifyRegimePhase4()` |
| `migrations/0007_gdelt_headlines.sql` | Added `top_headlines`, `spike_ratio` columns |
| `src/components/MacroBar.astro:416-458` | Frontend display logic |

### Design Decisions

1. **Why always-visible monitor?** (Updated 2026-01-23)
   - **Trust**: Users see continuous monitoring happening, not just reactive alerts
   - **Engagement**: "Updated 2h ago" shows freshness, encourages return visits
   - **Differentiation**: Clearly separates real-time news (📡) from static calendar (📅)

2. **Why only show headlines when elevated+?** Headlines are only relevant context when risk is actually elevated. Showing "Top Stories" during calm periods would add noise.

2. **Why 6h refresh?** Previously daily at 01:00 UTC missed midday breaking news. 6h intervals (01:00, 07:00, 13:00, 19:00) catch major events before market sessions.

3. **Why spike ratio?** Raw article counts vary by day. Spike vs 7-day baseline distinguishes actual news spikes from normal noise.

---

## High-Impact Growth Strategy (2026-01-22)

### Quick SEO Fixes Landed
- **JSON-LD datePublished bug**: Signal detail pages had invalid ISO format (`T0800:00Z` instead of `T08:00:00Z`)
- **Blog structured data missing**: Added BlogPosting + BreadcrumbList schemas for rich snippets
- **Graceful degradation**: Blog index and sitemap now handle missing DB without crashing

### Next Growth Priorities

| Priority | Category | Action | Impact |
|----------|----------|--------|--------|
| HIGH | Content/SEO | Evergreen guide pages | Long-tail search traffic |
| HIGH | Sharing | PNG/JPG OG images | Social cards actually render |
| HIGH | Sharing | Dynamic OG per signal/blog | Higher CTR on social shares |
| MEDIUM-HIGH | Measurement | Telegram click tracking | Understand funnel conversion |
| MEDIUM | Tech Debt | Fix failing tests | CI stability |

### Evergreen Content Strategy
Create landing pages for common search queries:
- "how to use trading signals" → `/guides/how-to-use-signals`
- "bullish vs bearish meaning" → `/guides/bullish-vs-bearish`
- "fear and greed index explained" → `/guides/fear-and-greed`

Link from:
- Signal cards (what does bullish mean?)
- MacroBar (what is Fear & Greed?)
- Asset tables (how to interpret signals?)

### OG Image Problem
**Current:** SVG OG images at `public/og-image.svg`
**Issue:** Twitter/X and Facebook don't render SVG OG images
**Fix:** Convert to PNG/JPG, add dynamic generation for signals/blogs

Options for dynamic OG:
1. `@vercel/og` (edge runtime, JSX-to-PNG)
2. `satori` + `sharp` (manual but flexible)
3. `cloudinary` transformations (external service)

### Measurement Gap
Currently tracking:
- Console.log on CTA clicks (client-side only, loses data)

Need to track:
- Server-side CTA click events (D1 table or Cloudflare Analytics)
- Funnel: page view → CTA visible → CTA click → Telegram join

---

## GDELT Enhancement Analysis (2026-01-22)

### Current Implementation
GDELT already wired in for Phase 4 Regime Detection:
- **Fetch + scoring:** `worker/src/data/gdelt.ts`
- **Daily job:** `worker/src/index.ts` (runs at 01:00 UTC via `/fetch-gdelt`)
- **Storage:** `migrations/0006_gdelt_scores.sql`, `worker/src/storage/d1.ts`
- **Regime integration:** `worker/src/signals/regime.ts`
- **UI display:** `src/components/MacroBar.astro`

### Current Limitations

| Issue | Current Behavior | Problem |
|-------|-----------------|---------|
| Refresh frequency | Once daily at 01:00 UTC | Misses midday breaking news |
| Scoring method | Raw article count | High baseline noise looks like "high risk" |
| User visibility | Abstract "High geopolitical risk" label | Not tangible—no actual headlines |

### Proposed Enhancements

**1. Spike-based scoring (vs 7-day baseline)**
```
Current: score = f(article_count, tone, diversity)
Problem: Normal news days have ~100+ articles, always looks "elevated"

Proposed: spike_ratio = today_count / avg_7d_count
- 1.0-1.5x: calm
- 1.5-2.0x: elevated
- 2.0-3.0x: high
- 3.0x+: critical
```

**2. More frequent refresh (every 6h)**
```
Current: 01:00 UTC only
Proposed: 01:00, 07:00, 13:00, 19:00 UTC

Benefits:
- Catches afternoon breaking news
- Updates UI before/after market hours
- Still respects GDELT rate limits (~1 req/sec)
```

**3. Top 3 headlines when elevated+**
```
When risk >= elevated, store and display:
[
  { title: "US imposes new tariffs on...", url: "https://..." },
  { title: "Military buildup reported in...", url: "https://..." },
  { title: "Emergency sanctions announced...", url: "https://..." }
]

Benefits:
- Tangible context (why is risk elevated?)
- Clickable source links
- Free (GDELT returns articles with titles/URLs)
```

### Files to Modify

| File | Change |
|------|--------|
| `worker/src/data/gdelt.ts` | Add `topHeadlines`, `spikeRatio`, 7-day baseline logic |
| `worker/src/index.ts` | Add GDELT fetch at 07:00, 13:00, 19:00 |
| `worker/src/storage/d1.ts` | Store/retrieve headlines |
| `migrations/0007_gdelt_headlines.sql` | Add `headlines_json` column or separate table |
| `src/components/MacroBar.astro` | Display clickable headlines when risk elevated |

### Key Decision: Volatility overlay, not directional signal
GDELT is noisy and NOT predictive of direction. Use it as:
- ✅ Risk/volatility overlay ("conditions are uncertain")
- ✅ Signal dampening (reduce conviction when geopolitical noise high)
- ❌ NOT a buy/sell signal

---

## Expert Review Feedback (2026-01-22)

### Strengths Identified
1. **Clear Telegram/VIP funneling** - Consistent CTA placement in `TelegramCTA.astro` and `VIPCTA.astro`
2. **Trust building** - Transparency pages and accuracy stats in `performance.astro`
3. **Solid edge-first architecture** - Astro + Workers + D1, public API/RSS
4. **High information density** - Macro context + asset breakdown

### Security Gaps Found
- `worker/src/index.ts` exposes trigger routes without auth:
  - `/trigger`, `/check-accuracy`, `/generate-weekly-blog`, `/send-daily-digest`
- `src/pages/api/v1/signals.ts` has `Access-Control-Allow-Origin: *`
- No rate limiting on any endpoints

### Compliance Gaps Found
- Disclaimer only in footer (`text-xs` = 12px, too small)
- "DYOR" is too casual for financial services
- "Get conviction" implies higher win rate (false advertising risk)
- No dedicated Terms/Risk Disclosure page
- Performance metrics lack methodology explanation

### APEX Differentiation Gaps
- VIP value proposition not explicit on free tier
- No regime state preview to show what users are missing
- No side-by-side Free vs VIP comparison

### Trust/Rigor Gaps
- Accuracy % shown without sample size
- No benchmark comparison (vs random baseline)
- Signal quality flags hidden on detail pages only

### UX/Ops Gaps
- Next-update logic hardcoded in frontend (doesn't respect weekends)
- CTA tracking only logs to console, not real analytics

### Key Files to Modify
| Purpose | File |
|---------|------|
| Worker triggers | `worker/src/index.ts` |
| API signals | `src/pages/api/v1/signals.ts` |
| VIP CTA | `src/components/VIPCTA.astro` |
| Performance | `src/pages/performance.astro` |
| Footer | `src/components/Footer.astro` |
| Layout | `src/layouts/Layout.astro` |
| Homepage | `src/pages/index.astro` |
| About | `src/pages/about.astro` |

### Copy to Revise
| Current | Revised | Location |
|---------|---------|----------|
| "Get conviction" | "Get the reasoning" | VIPCTA headline |
| "did you hold it?" | "did you understand why?" | VIPCTA subhead |
| "DYOR" | "Do your own due diligence" | Footer |

---

## First Principles: Truly Independent Metrics (2026-01-21)

### The Problem with Current Implementation

```
Current "3 indicators" - ALL DERIVED FROM PRICE:
├── Price vs MA20    → f(price history)
├── MA10 vs MA20     → f(price history)  ← CORRELATED!
└── RSI              → f(price history)  ← CORRELATED!

Correlation: ~0.7-0.9 between these indicators
When price moves up, ALL THREE tend to go bullish together.
```

**This is NOT true independence.** It's pseudo-diversification.

---

### First Principles: What Information Sources Exist?

| Source | What It Measures | Independence | Free Data? |
|--------|-----------------|--------------|------------|
| **Price** | Historical movement | Baseline | ✅ |
| **Volume** | Market participation/conviction | HIGH | ✅ CoinGecko, TwelveData |
| **Sentiment** | Crowd psychology | HIGH | ✅ Fear&Greed, Funding |
| **Flow** | Money movement | HIGH | ❌ Expensive (Glassnode) |
| **Positioning** | Who owns what | HIGH | ❌ Expensive (COT paid) |
| **Cross-Market** | Relative strength | MEDIUM | ✅ BTC Dominance |

---

### Volume: The Missing Independent Signal

**Why volume matters:**
- Price up + High volume = Strong conviction (bullish confirmation)
- Price up + Low volume = Weak move (likely to reverse)
- Price down + High volume = Capitulation (potential bottom)
- Price down + Low volume = Drift (trend continuation)

**Volume is TRULY independent:**
- Measures **participation**, not price direction
- Can confirm OR contradict price moves
- Low correlation with price-derived indicators

**Available sources:**
- Crypto: CoinGecko `/coins/{id}` has `total_volume.usd`
- Stocks: TwelveData `time_series` includes volume
- Forex: Volume less meaningful (OTC market), use tick volume

---

### Sentiment: Another Independent Signal

**Fear & Greed Index (Crypto):**
- 0-25: Extreme Fear → Contrarian bullish
- 25-45: Fear → Cautious
- 45-55: Neutral
- 55-75: Greed → Cautious
- 75-100: Extreme Greed → Contrarian bearish

**Funding Rate (Crypto):**
- Negative: Shorts paying longs → Bullish (market bearish, contrarian)
- 0-0.01%: Neutral
- 0.01%+: Longs paying shorts → Bearish (overcrowded long)

**Key insight:** We already HAVE Fear & Greed but only use it at macro level, not per-asset.

---

### Proposed: 3 TRULY Independent Signals

```
NEW MODEL - Truly Independent:
├── TREND:     Price vs MA20 (price-based baseline)
├── VOLUME:    Volume vs avg volume (participation)
└── SENTIMENT: Fear&Greed / Funding (psychology)

These measure DIFFERENT phenomena:
- Trend: Where price IS
- Volume: How much CONVICTION behind the move
- Sentiment: What CROWD is thinking (contrarian signal)
```

---

### Data Availability Analysis

#### Crypto (BTC, ETH)

| Metric | Source | API Call | Currently Used? |
|--------|--------|----------|-----------------|
| Price | CoinGecko OHLC | `/coins/{id}/ohlc` | ✅ Yes |
| MA20 | Calculated | - | ✅ Yes |
| 24h Volume | CoinGecko | `/coins/{id}` | ❌ **NO** |
| Avg Volume | Need historical | `/coins/{id}/market_chart` | ❌ **NO** |
| Funding Rate | Binance | `/fapi/v1/fundingRate` | ✅ Yes |
| Fear & Greed | Alternative.me | `/fng` | ✅ Macro only |

**Action:** Add volume from CoinGecko, use Fear & Greed for crypto signals

#### Forex (USD/JPY, EUR/USD, etc.)

| Metric | Source | API Call | Currently Used? |
|--------|--------|----------|-----------------|
| Price | TwelveData | `/quote` | ✅ Yes |
| MA20 | TwelveData | `/time_series` | ✅ Yes |
| RSI | TwelveData | `/rsi` | ✅ Yes |
| Volume | N/A | Forex is OTC | ❌ Not meaningful |

**Challenge:** Forex has no centralized volume. Alternatives:
- Tick volume (less reliable)
- DXY as sentiment proxy
- Interest rate differentials

#### Stocks (NVDA, AMD, etc.)

| Metric | Source | API Call | Currently Used? |
|--------|--------|----------|-----------------|
| Price | TwelveData | `/quote` | ✅ Yes |
| MA20 | TwelveData | `/time_series` | ✅ Yes |
| Volume | TwelveData | `/time_series` includes volume | ❌ **NO** |
| Avg Volume | Calculate from history | - | ❌ **NO** |
| RSI | TwelveData | `/rsi` | ✅ Yes |

**Action:** Extract volume from time_series response, calculate volume ratio

---

### Implementation Decision

**For Crypto:**
```
Indicators:
1. TREND:     Price vs MA20 (position)
2. VOLUME:    24h Volume vs 7d Avg Volume (ratio > 1.2 = high)
3. SENTIMENT: Fear & Greed Index (< 30 = bullish, > 70 = bearish)

Scoring:
- 3/3 agree: Strong signal
- 2/3 agree: Moderate signal
- 1/3 or mixed: Neutral
```

**For Stocks:**
```
Indicators:
1. TREND:     Price vs MA20 (position)
2. VOLUME:    Today Volume vs 20d Avg Volume (ratio)
3. RSI:       Keep as momentum proxy (no better free option)

Note: RSI is price-derived but serves as momentum proxy.
Volume provides true independence.
```

**For Forex:**
```
Indicators:
1. TREND:     Price vs MA20 (position)
2. DXY:       Dollar strength (for USD pairs)
3. RSI:       Momentum proxy

Note: Forex lacks volume. DXY provides cross-market context.
```

---

### Rate Limit Impact

**Current calls:** ~6 per run
**With volume addition:**
- Crypto: CoinGecko `/coins/{id}` already called, extract volume = +0 calls
- Stocks: Volume in `/time_series` response, extract = +0 calls

**Conclusion:** Zero additional API calls needed for volume!

---

### Implementation Complete (2026-01-21)

All steps implemented:
1. [x] Extract volume from CoinGecko market_chart for crypto
2. [x] Extract volume from TwelveData time_series for stocks
3. [x] Calculate volume ratio (current / average)
4. [x] Update bias calculation with Trend + Volume + Strength model
5. [x] Update UI to show volume confirmation (↑ high, ↓ low, — normal)

**Files Changed:**
- `worker/src/types.ts` - Added volume, avgVolume, volumeSignal fields
- `worker/src/data/binance.ts` - Fetch from CoinGecko market_chart
- `worker/src/data/twelvedata.ts` - Extract volume from time_series
- `worker/src/signals/bias.ts` - 3-indicator confluence: Trend + Volume + Strength
- `worker/src/storage/d1.ts` - Store volumeSignal in data_json
- `src/components/AssetTable.astro` - Vol column in UI
- `src/pages/api/v1/signals.ts` - Volume indicators in API
- `mcp-server/src/index.ts` - Volume in MCP output

**New Confluence Model:**
- **Trend**: Price vs MA20 (baseline)
- **Volume**: Confirms or diverges from trend (truly independent!)
- **Strength**: RSI/Funding rate

Volume interpretation:
- High volume (>1.2x avg) = confirms trend direction
- Low volume (<0.8x avg) = diverges (weak conviction, potential reversal)
- Normal volume = neutral

---

## Enhanced Independent Metrics (2026-01-21)

### Additions Based on First-Principles Analysis

An agent was spawned to argue from first principles what metrics we use and miss.

**Key finding:** Real blind spot was **macro regime awareness** - we had signals but weren't using them actively.

### Top 3 Implemented

| Indicator | What It Measures | Source | Impact |
|-----------|-----------------|--------|--------|
| **BBW** | Bollinger Band Width | Calculated from prices | Breakout/volatility detection |
| **F&G Contrarian** | Sentiment extremes | Alternative.me | Override bias at extremes |
| **Yield Curve** | Treasury 2Y-10Y spread | FRED | Recession/expansion regime |

### FRED Bridge for Tariff/News Shock Detection

Added FRED API data to detect policy shocks (tariffs, etc.) that don't show in price data immediately:

| Series | What It Detects | Shock Threshold |
|--------|-----------------|-----------------|
| **DCOILWTICO** | WTI Oil price | >5% daily change |
| **T5YIE** | 5Y Inflation Expectation | >3% elevated |

### Implementation Details

**Bollinger Band Width (BBW):**
```
BBW = (Upper Band - Lower Band) / Middle Band = (4 * stdDev) / MA20
- Low BBW (<0.05): Squeeze, breakout imminent
- High BBW (>0.15): High volatility, mean reversion possible
```

**Fear & Greed Contrarian Override:**
```
F&G ≤ 20 (Extreme Fear): contrarian = bullish
F&G ≥ 80 (Extreme Greed): contrarian = bearish
Otherwise: no override

Logic:
- If technicals are neutral → Use contrarian as bias
- If technicals conflict with contrarian → Move to Neutral
- If technicals agree with contrarian → Reinforce
```

**Yield Curve Regime:**
```
Spread < -0.2: Inverted (recession warning) → Risk-off
Spread -0.2 to 0.3: Flat (transition)
Spread > 0.3: Normal (healthy expansion) → Risk-on
```

**Macro Stress Level (0-10):**
```
Composite score from:
- VIX level (+/- 2)
- Yield curve (+/- 1.5)
- F&G extremes (+/- 1)
- Shock detection (+1.5)
```

### Files Changed

- `worker/src/types.ts` - Added bbWidth, oilPrice, oilChange, inflationExpectation, stressLevel, yieldCurve, fearGreedSignal, contrarian, shockDetected
- `worker/src/data/binance.ts` - BBW calculation for crypto
- `worker/src/data/twelvedata.ts` - BBW calculation for forex/stocks
- `worker/src/data/freesources.ts` - fetchOilPrice, fetchInflationExpectation
- `worker/src/data/alphavantage.ts` - Fetch oil and inflation data
- `worker/src/signals/macro.ts` - Enhanced macro signal with all new indicators
- `worker/src/signals/bias.ts` - Contrarian override in calculateCategoryBias
- `worker/src/skills/computeBias.ts` - Pass macro signal to bias calculation
- `worker/src/workflows/category.ts` - Bias now depends on macro

---

## IC Analysis: Asset Class-Specific Indicators (2026-01-21)

### Agent Critique Summary

An agent analyzed indicators from first principles. Key finding: **We're using wrong indicators for each asset class.**

### Information Coefficient (IC) by Indicator

| Indicator | Asset Class | Current IC | Notes |
|-----------|-------------|-----------|-------|
| Price vs MA20 | All | 0.15-0.25 | Weak for crypto (20D too slow) |
| Volume Ratio | Crypto/Stocks | 0.20-0.35 | **HIGH** - truly independent |
| RSI(14) | Forex/Stocks | 0.10-0.18 | **WRONG for forex** - forex trends, doesn't oscillate |
| Funding Rate | Crypto | 0.25-0.40 | **HIGH** - excellent for mean-reversion |
| Fear & Greed | Crypto | 0.15-0.25 | Currently macro-only, should be per-asset |
| DXY vs MA20 | Forex | 0.30-0.45 | **HIGH** - but only used at macro level |
| VIX Level | Macro | 0.20-0.30 | Good |
| Yield Curve | Macro | 0.35-0.50 | **VERY HIGH** - not used in forex bias |
| Rate Differentials | Forex | 0.45-0.60 | **MISSING** - huge opportunity |

### Asset Class Mismatch

| Asset Class | Current IC | Achievable IC | Main Problem |
|-------------|-----------|---------------|--------------|
| **Crypto** | ~0.22 | ~0.32 | 20D MA too slow, F&G not per-asset |
| **Forex** | ~0.18 | ~0.40 | RSI is objectively wrong |
| **Stocks** | ~0.22 | ~0.38 | Missing sector filter |

### Tier 1 Fixes (Zero API cost)

| Fix | Target | IC Gain | Effort |
|-----|--------|---------|--------|
| Forex: Replace RSI with yield curve signal | Forex | +15-25% | 5 min |
| Forex: Link DXY strength to USD pair bias | Forex | +15-20% | 10 min |
| Crypto: F&G per-asset override | Crypto | +10-15% | 5 min |
| Crypto: Use 7D MA instead of 20D | Crypto | +5-10% | 5 min |

### Tier 2 Fixes (1-2 API calls) - IMPLEMENTED BUT BLOCKED

| Fix | Target | IC Gain | Status |
|-----|--------|---------|--------|
| Stocks: Sector ETF comparison (XLK/XLE) | Stocks | +15-20% | ⚠️ Code ready, fetch blocked |
| Stocks: Relative strength vs SPY | Stocks | +10-15% | ⚠️ Code ready, fetch blocked |

**Constraint discovered:** TwelveData rate limit (8 credits/min) with 11 symbols exceeds Cloudflare Worker's 30s execution limit. Code is complete but benchmark fetch is disabled.

**Workaround options:**
1. Separate hourly cron for benchmarks with longer cache
2. Use Alpha Vantage for ETF data (separate quota)
3. Reduce to 5 stocks + 3 benchmarks = 8 symbols total

### Key Insight: What Each Asset Class Needs

| Asset Class | Primary Driver | Current Gap |
|-------------|---------------|-------------|
| **Crypto** | Sentiment + Flow | F&G not linked to asset bias |
| **Forex** | Rate differentials + DXY | Using RSI (meaningless) |
| **Stocks** | Sector rotation | Ignoring sector context |

