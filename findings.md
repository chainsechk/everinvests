# Findings & Decisions

## Indicator Confluence Analysis (2026-01-21)

### First Principles: What Problem Are We Solving?

**The core question:** "vs_20d alone would not say much, need a combo of similar indicators"

This is fundamentally about **signal confidence**. A single indicator (price above MA20) tells you:
- The trend direction (above = uptrend tendency)
- Nothing about strength, momentum, or sustainability

**First principles breakdown:**
1. **What is vs_20d measuring?** → Trend position (lagging)
2. **What does it miss?** → Momentum, strength, acceleration
3. **What would give confluence?** → Indicators measuring *different* aspects of price action

---

### Current System Analysis

```
Current Indicators:
┌─────────────────┬────────────────────┬──────────────────┐
│ Category        │ Indicator 1        │ Indicator 2      │
├─────────────────┼────────────────────┼──────────────────┤
│ Crypto          │ Price vs MA20      │ Funding Rate     │
│ Forex/Stocks    │ Price vs MA20      │ RSI (14)         │
└─────────────────┴────────────────────┴──────────────────┘

Bias Rule: 2/2 bullish = Bullish, 2/2 bearish = Bearish, else Neutral
```

**What's good:**
- 2 independent signals (trend + momentum/sentiment)
- Reduces false positives vs single indicator

**What's missing:**
- No measure of trend *strength* (is it accelerating or fading?)
- No shorter-term confirmation (MA20 is 4 weeks of data)
- RSI can stay overbought for extended periods in strong trends

---

### Candidate Indicators: Fetch vs Calculate

#### Available from TwelveData (Already Using)
| Indicator | API Endpoint | Credits/Call | Notes |
|-----------|--------------|--------------|-------|
| Price | `/quote` | 1 | Already batched |
| RSI (14) | `/rsi` | 1 | Already using |
| SMA (any period) | `/sma` | 1 | **Extra call needed** |
| EMA (any period) | `/ema` | 1 | **Extra call needed** |
| MACD | `/macd` | 1 | **Extra call needed** |
| ADX | `/adx` | 1 | Trend strength |
| Stochastic | `/stoch` | 1 | Mean reversion |

**TwelveData rate limit: 8 credits/minute**

#### Can Calculate Locally (No API Cost)
| Indicator | Required Data | Calculation |
|-----------|---------------|-------------|
| MA10 | 10 daily closes | `sum(closes) / 10` |
| MA50 | 50 daily closes | `sum(closes) / 50` |
| EMA | Price history | `EMA_today = (Price * k) + (EMA_yesterday * (1-k))` |
| Price Change % | Current + previous | `(current - previous) / previous` |
| Trend Slope | MA values over time | Linear regression |
| Volatility (ATR-like) | High/Low/Close | `avg(high - low)` over N days |

**Key insight:** We already fetch 25 days of price history for MA20 calculation via `/time_series`. This data can be reused for:
- MA10 (shorter MA for crossover)
- Price momentum (5-day ROC)
- Simple volatility measure

---

### Rate Limit Budget Analysis

**Current API calls per signal run:**
```
TwelveData (forex + stocks):
- Batch quote:      1 call × 2 categories = 2 credits
- Batch time_series: 1 call × 2 categories = 2 credits (includes 25 days data)
- Batch RSI:        1 call × 2 categories = 2 credits
Total: 6 credits per run

Runs per day: ~6 (crypto 3x, forex 3x weekdays, stocks 2x weekdays)
Estimated: 6 × 6 = 36 credits/day (well under 800 limit)
```

**If we add more TwelveData indicators:**
- Adding MACD: +2 credits/run → 48 credits/day
- Adding ADX: +2 credits/run → 60 credits/day
- Still well under limit, but increases rate limit risk (8/min)

---

### First Principles: What Makes Good Confluence?

**Principle 1: Indicators should measure DIFFERENT things**
Bad confluence: MA10 + MA20 + MA50 (all measure trend, high correlation)
Good confluence: MA20 (trend) + RSI (momentum) + ADX (strength)

**Principle 2: Fast + Slow confirmation**
- Slow indicator (MA20): Shows established trend
- Fast indicator (MA10, 5-day ROC): Shows recent momentum
- Confirmation: When fast and slow agree

**Principle 3: Avoid indicator redundancy**
- RSI and Stochastic measure similar things (momentum oscillators)
- Pick one, not both

**Principle 4: Keep it simple**
- More indicators ≠ better signals
- 2-3 well-chosen indicators > 5 correlated ones
- Diminishing returns after 3 indicators

---

### Recommended Approach: Calculate Locally

**Why calculate instead of fetch:**
1. **Zero additional API calls** - use existing time_series data
2. **No rate limit risk** - local computation is instant
3. **Same data quality** - we already have the closes
4. **More flexible** - can experiment with parameters

**Proposed confluence model (3 indicators):**

| Signal | Source | Interpretation |
|--------|--------|----------------|
| **Trend** | Price vs MA20 | Position in trend (above/below) |
| **Momentum** | MA10 vs MA20 | Trend acceleration (golden/death cross forming) |
| **Strength** | RSI (14) | Overbought/oversold, momentum confirmation |

**Why this combination:**
- MA20: Current trend direction (already have)
- MA10 vs MA20: Crossover signal - when MA10 > MA20, trend is strengthening
- RSI: Momentum confirmation + extreme readings warning

**Confluence scoring:**
```
Bullish:
  - Price > MA20 (+1)
  - MA10 > MA20 (+1)
  - RSI < 70 and rising OR RSI < 30 oversold (+1)

Bearish:
  - Price < MA20 (+1)
  - MA10 < MA20 (+1)
  - RSI > 30 and falling OR RSI > 70 overbought (+1)

Score: 3/3 = Strong signal, 2/3 = Moderate, 1/3 or less = Weak/Neutral
```

---

### Implementation Plan

**Option A: Minimal change (recommended)**
Calculate MA10 from existing time_series data:
```typescript
// Already have 25 days of closes from time_series
const ma10 = closes.slice(0, 10).reduce((a,b) => a+b) / 10;
const ma20 = closes.slice(0, 20).reduce((a,b) => a+b) / 20;

// New signal: MA10 vs MA20
const maSignal = ma10 > ma20 ? "bullish" : ma10 < ma20 ? "bearish" : "neutral";
```

**Changes required:**
1. `twelvedata.ts`: Return MA10 alongside MA20 from time_series
2. `types.ts`: Add `ma10` to `AssetData`
3. `bias.ts`: Add MA crossover as third indicator
4. Update confluence scoring to 3 indicators

**Option B: Add TwelveData MACD (more API calls)**
```
Pros:
- MACD histogram is a leading indicator
- Well-known signal

Cons:
- Extra API call per category
- MACD can be calculated from EMAs locally
```

**Recommendation: Option A**
- Zero additional API cost
- Data already available
- Covers trend + momentum + strength dimensions

---

### Summary Decision

**Question:** Should we fetch more indicators or calculate locally?

**Answer:** **Calculate locally** using existing data.

**Rationale:**
1. We already fetch 25 days of closes via `/time_series`
2. MA10 can be computed from first 10 closes (no extra API call)
3. This gives us 3 independent signals:
   - Trend position (Price vs MA20)
   - Trend momentum (MA10 vs MA20)
   - Strength (RSI)
4. Rate limit risk = 0 increase
5. Implementation is ~20 lines of code change

---

## Implementation Complete (2026-01-21)

### Changes Made

**1. Types (worker/src/types.ts)**
- Added `ma10: number` to `AssetData` interface
- Added `maCrossover: "bullish" | "bearish" | "neutral"` to `AssetSignal`
- Added `indicators` object and `confluence` string to `AssetSignal`

**2. Data Fetchers**
- `worker/src/data/twelvedata.ts`: Now calculates both MA10 and MA20 from time_series data (no extra API calls)
- `worker/src/data/binance.ts`: Updated CoinGecko and CoinCap functions to calculate both MA10 and MA20

**3. Bias Calculation (worker/src/signals/bias.ts)**
- New 3-indicator confluence model:
  - **Trend**: Price vs MA20 (±1% threshold)
  - **Momentum**: MA10 vs MA20 (±0.5% threshold for crossover)
  - **Strength**: RSI (45/55 thresholds in middle range) or Funding Rate
- Bias rule: 2+ of 3 signals agree → that direction, else Neutral
- Added confluence scoring (e.g., "3/3 bullish", "2/3 bearish", "mixed")

**4. Storage (worker/src/storage/d1.ts)**
- Updated `saveAssetSignals` to store full indicator breakdown in `data_json`

**5. UI (src/components/AssetTable.astro)**
- Added "MA X" (MA crossover) column with up/down arrows
- Parses `data_json` to display crossover signal

**6. APIs**
- `src/pages/api/v1/signals.ts`: Updated to parse new indicator format with backwards compat
- `mcp-server/src/index.ts`: Updated to show T:B/M:N/S:B format in get_signal output

### Verification
- TypeScript: All checks pass (worker, frontend, mcp-server)
- Tests: All 87 tests pass
- Build: Frontend builds successfully

### No Database Migration Needed
The new indicator data is stored in the existing `data_json` column - no schema changes required.

---

## Previous Findings (Reference)

### Signal Indicator Confluence (Previous Note)
**Problem:** Raw values like `vsMA20: "above"` are not actionable.
**Solution:** Expose **interpreted signals** showing confluence.

### IMPORTANT: Rate Limit Distinction
**External APIs (worker/src/data/*.ts) - RATE LIMITED, MUST BE SEQUENTIAL**
**D1 Database (src/pages/*.astro) - NO RATE LIMITS, CAN PARALLELIZE**

### Issues Encountered
| Issue | Resolution |
|-------|------------|
| Binance API blocked by CF Workers | Migrated to CoinGecko API for crypto data |
| CoinGecko requires User-Agent header | Added `User-Agent: EverInvests/1.0` to fetch |
| TwelveData 8 req/min rate limit | Batch API, sequential calls with delays |

---
*Update this file after every 2 view/browser/search operations*
