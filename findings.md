# Findings & Decisions

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

## Previous Analysis (Superseded)

The MA10 vs MA20 crossover implementation was a step forward but not truly independent.
The new model focuses on:
- **Price action** (what the market is doing)
- **Volume** (conviction behind the move)
- **Sentiment** (crowd psychology)

These three measure fundamentally different market phenomena.
