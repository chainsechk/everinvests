# Macro Data API Expansion Plan

## Current Architecture

### Data Sources in Use
| Source | Data | Free Tier | TTL |
|--------|------|-----------|-----|
| **Yahoo Finance** | DXY (DX-Y.NYB), VIX (^VIX) | Unlimited (unauthenticated) | 30 min |
| **Alpha Vantage** | US 10Y Treasury | 25 req/day | 1 hour |
| **Twelve Data** | Forex, Stocks | 800 req/day, 8 req/min | 5-15 min |
| **CoinGecko** | Crypto OHLC (BTC, ETH) | ~30 req/min | varies |

### Current Macro Signal Logic
```
MacroSignal = {
  dxyBias: "strong" | "weak" | "neutral"     // DXY vs 20D MA (±1%)
  vixLevel: "risk_on" | "risk_off" | "neutral"  // VIX < 12 / > 20
  yieldsBias: "rising" | "falling" | "stable"   // 10Y < 3.5% / > 4.5%
  overall: "Risk-on" | "Risk-off" | "Mixed"     // 2/3 agreement rule
}
```

---

## Proposed New Indicators

### Tier 1: High Priority (Significant Signal Value)

#### 1. Yield Curve Spread (2s10s)
**Why:** Inverted yield curve is the most reliable recession predictor. Critical for risk assessment.

| Attribute | Value |
|-----------|-------|
| **Source** | FRED API |
| **Series ID** | `T10Y2Y` (10Y - 2Y spread) |
| **Free Tier** | 120 req/min |
| **Signal Logic** | `< 0` = Risk-off (inverted), `> 0.5` = Risk-on, else Neutral |
| **TTL** | 4 hours (daily data) |

#### 2. Gold (XAU)
**Why:** Safe-haven asset. Rising gold = risk-off sentiment. Inversely correlated with USD and risk appetite.

| Attribute | Value |
|-----------|-------|
| **Source** | Yahoo Finance |
| **Symbol** | `GC=F` (Gold Futures) |
| **Free Tier** | Unlimited |
| **Signal Logic** | Price vs 20D MA (like DXY) |
| **TTL** | 30 min |

#### 3. Crypto Fear & Greed Index
**Why:** Direct sentiment indicator for crypto signals. More actionable than pure technicals.

| Attribute | Value |
|-----------|-------|
| **Source** | Alternative.me API |
| **Endpoint** | `https://api.alternative.me/fng/` |
| **Free Tier** | Unlimited |
| **Response** | `{ value: "45", value_classification: "Fear" }` |
| **Signal Logic** | `< 25` = Extreme Fear (contrarian bullish), `> 75` = Extreme Greed (contrarian bearish) |
| **TTL** | 1 hour (updates daily) |

### Tier 2: Medium Priority (Useful Context)

#### 4. WTI Crude Oil
**Why:** Energy prices affect inflation expectations and corporate earnings. High oil = stagflation risk.

| Attribute | Value |
|-----------|-------|
| **Source** | Yahoo Finance |
| **Symbol** | `CL=F` (WTI Futures) |
| **Free Tier** | Unlimited |
| **Signal Logic** | Price vs 20D MA + absolute level (> $90 = inflationary) |
| **TTL** | 30 min |

#### 5. S&P 500
**Why:** Benchmark equity index. Provides context for individual stock signals.

| Attribute | Value |
|-----------|-------|
| **Source** | Yahoo Finance |
| **Symbol** | `^GSPC` |
| **Free Tier** | Unlimited |
| **Signal Logic** | Price vs 20D MA |
| **TTL** | 30 min |

#### 6. Fed Funds Rate
**Why:** Central bank policy directly impacts all asset classes.

| Attribute | Value |
|-----------|-------|
| **Source** | FRED API |
| **Series ID** | `FEDFUNDS` |
| **Free Tier** | 120 req/min |
| **Signal Logic** | Track changes (rate hikes = tightening = risk-off) |
| **TTL** | 24 hours (monthly data) |

### Tier 3: Lower Priority (Nice to Have)

#### 7. Bitcoin Dominance
**Why:** Within-crypto risk indicator. Rising BTC dominance = flight to quality within crypto.

| Attribute | Value |
|-----------|-------|
| **Source** | CoinGecko `/global` endpoint |
| **Free Tier** | ~30 req/min |
| **Signal Logic** | `> 55%` = Risk-off in crypto, `< 45%` = Risk-on (alt season) |
| **TTL** | 1 hour |

#### 8. CNN Fear & Greed Index (Stocks)
**Why:** Sentiment indicator for equity signals.

| Attribute | Value |
|-----------|-------|
| **Source** | CNN DataViz API (scraping) |
| **Endpoint** | `https://production.dataviz.cnn.io/index/fearandgreed/graphdata` |
| **Free Tier** | Unlimited (unofficial) |
| **Reliability** | Medium - may break without notice |
| **TTL** | 1 hour |

#### 9. Unemployment Rate
**Why:** Lagging indicator but useful for broader economic context.

| Attribute | Value |
|-----------|-------|
| **Source** | FRED API |
| **Series ID** | `UNRATE` |
| **Free Tier** | 120 req/min |
| **TTL** | 24 hours (monthly data) |

---

## Recommended Implementation Order

### Phase 1: Quick Wins (Yahoo Finance Only)
No new API keys needed. Extends existing `yahoo.ts` module.

```typescript
// Add to worker/src/data/yahoo.ts
export async function fetchGold(): Promise<{ price: number; ma20: number; cached: boolean }>;
export async function fetchOil(): Promise<{ price: number; ma20: number; cached: boolean }>;
export async function fetchSPX(): Promise<{ price: number; ma20: number; cached: boolean }>;
```

**Estimated additions:**
- Gold (GC=F)
- Oil (CL=F)
- S&P 500 (^GSPC)

### Phase 2: FRED Integration
Requires FRED API key (free registration at https://fred.stlouisfed.org/docs/api/api_key.html).

```typescript
// New file: worker/src/data/fred.ts
export async function fetchYieldCurve(): Promise<{ spread: number; isInverted: boolean }>;
export async function fetchFedFunds(): Promise<{ rate: number }>;
```

**API Pattern:**
```
GET https://api.stlouisfed.org/fred/series/observations
  ?series_id=T10Y2Y
  &api_key={key}
  &file_type=json
  &limit=1
  &sort_order=desc
```

### Phase 3: Sentiment Indices
Add Alternative.me for crypto sentiment.

```typescript
// New file: worker/src/data/sentiment.ts
export async function fetchCryptoFearGreed(): Promise<{ value: number; classification: string }>;
```

---

## Updated MacroSignal Type

```typescript
export interface MacroData {
  // Existing
  dxy: number;
  dxyMa20: number;
  vix: number;
  us10y: number;

  // Phase 1 additions
  gold?: number;
  goldMa20?: number;
  oil?: number;
  oilMa20?: number;
  spx?: number;
  spxMa20?: number;

  // Phase 2 additions
  yieldCurveSpread?: number;  // T10Y2Y
  fedFundsRate?: number;

  // Phase 3 additions
  cryptoFearGreed?: number;

  timestamp: string;
}

export interface MacroSignal {
  // Existing
  dxyBias: "strong" | "weak" | "neutral";
  vixLevel: "risk_on" | "risk_off" | "neutral";
  yieldsBias: "rising" | "falling" | "stable";

  // New
  goldBias?: "safe_haven" | "risk_on" | "neutral";
  oilBias?: "inflationary" | "deflationary" | "neutral";
  yieldCurve?: "inverted" | "normal" | "flat";
  cryptoSentiment?: "extreme_fear" | "fear" | "neutral" | "greed" | "extreme_greed";

  overall: MacroOverall;
}
```

---

## Signal Logic Updates

### Enhanced Overall Calculation

```typescript
function calculateMacroSignal(data: MacroData): MacroSignal {
  // Existing scoring (3 signals)
  let riskOnScore = 0;
  let riskOffScore = 0;

  // DXY: weak = risk-on, strong = risk-off
  if (dxyBias === "weak") riskOnScore++;
  if (dxyBias === "strong") riskOffScore++;

  // VIX: < 12 = risk-on, > 20 = risk-off
  if (vixLevel === "risk_on") riskOnScore++;
  if (vixLevel === "risk_off") riskOffScore++;

  // Yields: < 3.5% = risk-on, > 4.5% = risk-off
  if (yieldsBias === "falling") riskOnScore++;
  if (yieldsBias === "rising") riskOffScore++;

  // NEW: Yield curve (strongest recession signal)
  if (data.yieldCurveSpread !== undefined) {
    if (data.yieldCurveSpread < 0) riskOffScore += 2;  // Double weight for inversion
    if (data.yieldCurveSpread > 0.5) riskOnScore++;
  }

  // NEW: Gold (safe haven demand)
  if (goldBias === "safe_haven") riskOffScore++;
  if (goldBias === "risk_on") riskOnScore++;

  // Determine overall with weighted scoring
  const totalSignals = 5; // Adjust based on available data
  if (riskOnScore >= totalSignals * 0.6) return "Risk-on";
  if (riskOffScore >= totalSignals * 0.6) return "Risk-off";
  return "Mixed";
}
```

---

## API Rate Budget

### Current Usage
| API | Daily Budget | Current Usage | Remaining |
|-----|--------------|---------------|-----------|
| Alpha Vantage | 25 | ~3 (Treasury only) | 22 |
| Twelve Data | 800 | ~200 (forex+stocks) | 600 |
| Yahoo Finance | Unlimited | 2 (DXY, VIX) | Unlimited |

### With Proposed Additions
| API | Daily Budget | Projected Usage | Notes |
|-----|--------------|-----------------|-------|
| Alpha Vantage | 25 | 3 | Unchanged |
| Twelve Data | 800 | 200 | Unchanged |
| Yahoo Finance | Unlimited | 5 | +Gold, Oil, SPX |
| FRED | Unlimited* | 6 | Yield curve, Fed funds |
| Alternative.me | Unlimited | 3 | Crypto F&G |

*FRED: 120 req/min, no daily limit

---

## Implementation Notes

### Cloudflare Workers Constraints
- **10ms CPU limit**: All new fetches must use caching aggressively
- **Parallel fetching**: Group independent API calls in `Promise.all()`
- **Graceful degradation**: All new indicators should be optional with fallbacks

### Cache Strategy
```typescript
// Add to DEFAULT_TTL
YAHOO_FINANCE: 30 * 60,      // 30 min (existing)
FRED_DAILY: 4 * 60 * 60,     // 4 hours for daily economic data
FRED_MONTHLY: 24 * 60 * 60,  // 24 hours for monthly data
SENTIMENT: 60 * 60,          // 1 hour for sentiment indices
```

### Error Handling Pattern
```typescript
async function fetchWithFallback<T>(
  fetcher: () => Promise<T>,
  fallback: T,
  name: string
): Promise<{ data: T; isFallback: boolean }> {
  try {
    return { data: await fetcher(), isFallback: false };
  } catch (error) {
    console.warn(`[${name}] Fetch failed, using fallback:`, error);
    return { data: fallback, isFallback: true };
  }
}
```

---

## Summary

| Phase | Indicators | API | Effort | Value |
|-------|------------|-----|--------|-------|
| 1 | Gold, Oil, SPX | Yahoo Finance | Low | High |
| 2 | Yield Curve, Fed Funds | FRED | Medium | High |
| 3 | Crypto F&G | Alternative.me | Low | Medium |

**Recommendation:** Start with Phase 1 (Yahoo Finance additions) as they require no new API keys and provide immediate value for signal quality.

---

## Future: Alternative Data Providers (OpenBB Catalog)

Based on [OpenBB's data provider catalog](https://my.openbb.co/app/platform/data-providers), here's a ranked analysis of providers that could replace or supplement current sources. All providers are evaluated for **Cloudflare Workers compatibility** (REST API, JSON responses, no Python/SDK dependencies).

### Tier A: High Value / Easy Integration

These providers offer significant value with generous free tiers and REST APIs.

| Provider | Data | Free Tier | Why Consider |
|----------|------|-----------|--------------|
| **FRED** | 816k+ economic series | 120 req/min | Best-in-class economic data. Treasury yields, unemployment, GDP, inflation. Already planned for Phase 2. |
| **Yahoo Finance** | Stocks, ETFs, indices, forex, commodities | Unlimited | Already in use. Unofficial but reliable. |
| **Financial Modeling Prep (FMP)** | 70k securities, 4.5k crypto, 1.5k forex | 500MB/month bandwidth | Could replace Twelve Data for stocks. Better crypto coverage. Real-time with $19/mo paid tier. |
| **EIA** | Energy data (oil, gas, renewables) | Free with registration | Official U.S. energy data. Better than Yahoo for oil fundamentals. |
| **ECB** | European economic data, EUR rates | Free | Official source for EUR/USD context, European inflation. |

### Tier B: Moderate Value / Niche Use Cases

Useful for specific data needs but not essential for core signals.

| Provider | Data | Free Tier | Use Case |
|----------|------|-----------|----------|
| **Polygon.io** | U.S. stocks, options, forex | 5 req/min | Premium data quality. Too limited for free tier but excellent paid ($29/mo). |
| **Tiingo** | Stocks, crypto, forex | 50 symbols/hour | 30+ years historical. Good for backtesting. Limited real-time. |
| **BLS** | Employment, CPI, wages | Free | Official labor/inflation data. Monthly updates only. |
| **IMF** | Global economic data | Free | International macro context. Infrequent updates. |
| **OECD** | Economic data (38 countries) | Free | International comparisons. Low frequency. |
| **SEC** | Company filings, insider trades | Free | Fundamental analysis. Not useful for daily signals. |

### Tier C: Low Priority / Limited Free Access

Either too limited in free tier or not directly useful for market signals.

| Provider | Data | Free Tier | Notes |
|----------|------|-----------|-------|
| **Intrinio** | Financial data | Paid only | No free tier. Enterprise-focused. |
| **Benzinga** | News, movers | Paid only | News API. Not useful for technical signals. |
| **CBOE** | Options data | Limited | VIX source but Yahoo proxy works fine. |
| **Tradier** | Trading API | Sandbox only | Brokerage API, not data API. |
| **Trading Economics** | 196 countries | Paid only | Excellent data but expensive. |
| **NASDAQ** | Exchange data | Premium only | Official but restrictive. |

### Tier D: Not Recommended

Incompatible with architecture or unreliable for production.

| Provider | Why Not |
|----------|---------|
| **FinViz** | Unofficial scraping. Breaks frequently. |
| **WSJ** | No API. Would require scraping. |
| **Stockgrid** | Unofficial. Limited data. |

### Special Case: Seeking Alpha

Seeking Alpha offers valuable **Quant Ratings** (1-5 score) and **Factor Grades** (A+ to F) for ~5,600 stocks, but has **no official API** even for Premium subscribers.

#### What's Valuable
| Data | Description | Signal Value |
|------|-------------|--------------|
| **Quant Rating** | 1.0-5.0 score based on 100+ metrics | High - objective stock scoring |
| **Factor Grades** | Value, Growth, Profitability, Momentum, EPS Revisions | High - multi-factor analysis |
| **SA Authors Rating** | Aggregated analyst opinions | Medium |
| **News/Analysis** | Premium articles and alerts | Low for automated signals |

#### OpenBB Integration: Very Limited
The [openbb-seeking-alpha](https://pypi.org/project/openbb-seeking-alpha/) package only provides **earnings calendar** data - NOT Quant Ratings or Factor Grades.

#### Access Options

| Method | Cost | Viability | Notes |
|--------|------|-----------|-------|
| **SA Premium subscription** | $269/yr | Web only | No API access included |
| **RapidAPI (apidojo)** | ~$0.01-0.05/req | Medium | Unofficial, may have Quant data |
| **Manual CSV export** | Free | Works | Export screener daily, upload to D1 |
| **Web scraping** | Free | Risky | Violates TOS, IP blocks likely |

#### RapidAPI Integration (If Budget Allows)

```typescript
// worker/src/data/seekingalpha.ts
const SA_RAPIDAPI = "https://seeking-alpha.p.rapidapi.com";

interface SAQuantRating {
  ticker: string;
  quantRating: number;      // 1.0-5.0
  quantGrade: string;       // "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell"
  valueGrade: string;       // A+ to F
  growthGrade: string;
  profitabilityGrade: string;
  momentumGrade: string;
  epsRevisionsGrade: string;
}

export async function fetchQuantRating(
  ticker: string,
  rapidApiKey: string
): Promise<SAQuantRating | null> {
  const url = `${SA_RAPIDAPI}/symbols/get-ratings?symbol=${ticker}`;
  const response = await fetch(url, {
    headers: {
      "X-RapidAPI-Key": rapidApiKey,
      "X-RapidAPI-Host": "seeking-alpha.p.rapidapi.com"
    }
  });
  // Parse and return Quant data
}
```

**Estimated cost:** $10-50/month for ~1000 requests/day

#### Manual Workflow Alternative

For cost-free integration with existing SA Premium:

1. Daily: Export "Top Stocks by Quant Rating" screener to CSV
2. Upload to Cloudflare D1 via simple script
3. Worker reads from D1 for signal generation

```typescript
// Schema for D1 table
CREATE TABLE sa_quant_ratings (
  ticker TEXT PRIMARY KEY,
  quant_rating REAL,
  quant_grade TEXT,
  value_grade TEXT,
  growth_grade TEXT,
  profitability_grade TEXT,
  momentum_grade TEXT,
  eps_revisions_grade TEXT,
  updated_at TEXT
);
```

#### Signal Integration

```typescript
// Enhanced stock signal with SA Quant data
function computeStockBias(
  technicals: { price: number; ma20: number; rsi: number },
  quant?: SAQuantRating
): Bias {
  let score = 0;

  // Technical signals (existing)
  if (technicals.price > technicals.ma20) score++;
  if (technicals.rsi < 70 && technicals.rsi > 30) score++;

  // SA Quant signals (new)
  if (quant) {
    if (quant.quantRating >= 4.0) score += 2;  // Strong Buy/Buy
    else if (quant.quantRating <= 2.0) score -= 2;  // Sell/Strong Sell

    // Factor grades boost
    if (quant.momentumGrade.startsWith('A')) score++;
    if (quant.epsRevisionsGrade.startsWith('A')) score++;
  }

  return score >= 2 ? "Bullish" : score <= -2 ? "Bearish" : "Neutral";
}
```

#### Recommendation

| Approach | When to Use |
|----------|-------------|
| **Skip for now** | MVP phase, focus on free APIs |
| **Manual CSV** | If you check SA daily anyway |
| **RapidAPI** | If signal quality is critical and budget allows |

---

## Provider Migration Scenarios

### Scenario 1: Replace Twelve Data with FMP
**Trigger:** Hit Twelve Data rate limits consistently or need more crypto coverage.

| Aspect | Twelve Data | FMP |
|--------|-------------|-----|
| Free Tier | 800 req/day, 8 req/min | 500MB/month |
| Stocks | Good | Better (70k vs limited) |
| Crypto | None | 4,500 tickers |
| Forex | Good | Good (1,500 pairs) |
| Real-time | Delayed | Delayed (real-time at $19/mo) |

**Migration effort:** Medium - different response format, new API key.

### Scenario 2: Replace Alpha Vantage with FRED
**Trigger:** Alpha Vantage 25 req/day limit becomes blocking.

| Aspect | Alpha Vantage | FRED |
|--------|---------------|------|
| Free Tier | 25 req/day | 120 req/min |
| Treasury | Yes | Yes (better series) |
| Economic | Limited | Comprehensive |
| Stocks | Yes (wasted on this) | No |

**Migration effort:** Low - similar REST pattern, add FRED API key.

### Scenario 3: Add EIA for Energy Data
**Trigger:** Need better oil/gas fundamentals than Yahoo proxies.

```typescript
// worker/src/data/eia.ts
const EIA_API = "https://api.eia.gov/v2";

export async function fetchWTIPrice(apiKey: string): Promise<number> {
  const url = `${EIA_API}/petroleum/pri/spt/data/?api_key=${apiKey}&frequency=daily&data[0]=value&facets[product][]=EPCBRENT&sort[0][column]=period&sort[0][direction]=desc&length=1`;
  // Returns official EIA spot prices
}
```

**Migration effort:** Low - new module, free API key registration.

---

## Provider Comparison Matrix

| Need | Current | Best Alternative | Switch When |
|------|---------|------------------|-------------|
| **Stocks** | Twelve Data | FMP or Polygon | Rate limits hit |
| **Forex** | Twelve Data | FMP | Need more pairs |
| **Crypto** | CoinGecko | FMP or Tiingo | Need more tickers |
| **Treasury** | Alpha Vantage | FRED | Need more economic data |
| **VIX/DXY** | Yahoo Finance | - | Keep (works well) |
| **Oil** | Yahoo (planned) | EIA | Need fundamentals |
| **Economic** | - | FRED | Phase 2 |

---

## Recommended Future Roadmap

### Phase 4: Provider Diversification (If Needed)
Add fallback providers for resilience.

```typescript
// worker/src/data/fallback.ts
async function fetchStockWithFallback(ticker: string): Promise<AssetData> {
  try {
    return await fetchFromTwelveData(ticker);
  } catch {
    console.warn(`[Fallback] Twelve Data failed, trying FMP`);
    return await fetchFromFMP(ticker);
  }
}
```

### Phase 5: Premium Upgrade Path
If free tiers become limiting:

| Provider | Paid Tier | Cost | Benefit |
|----------|-----------|------|---------|
| FMP | Starter | $19/mo | Unlimited real-time |
| Polygon | Starter | $29/mo | 100 req/sec, real-time |
| Tiingo | Power | $30/mo | Full API access |

**Total for production-grade:** ~$50-80/month

---

## Sources
- [FRED API Documentation](https://fred.stlouisfed.org/docs/api/fred/)
- [FRED Series: Fed Funds Rate](https://fred.stlouisfed.org/series/FEDFUNDS)
- [Yahoo Finance Commodities](https://finance.yahoo.com/markets/commodities/)
- [Alternative.me Crypto Fear & Greed](https://alternative.me/crypto/fear-and-greed-index/)
- [CoinGecko API](https://www.coingecko.com/en/api)
- [CNN Fear & Greed Index](https://www.cnn.com/markets/fear-and-greed)
- [OpenBB Data Providers](https://my.openbb.co/app/platform/data-providers)
- [FMP Pricing](https://site.financialmodelingprep.com/pricing-plans)
- [Polygon.io Pricing](https://polygon.io/pricing)
- [Tiingo Pricing](https://www.tiingo.com/about/pricing)
- [EIA API](https://www.eia.gov/opendata/)
- [Seeking Alpha Quant Ratings FAQ](https://help.seekingalpha.com/premium/quant-ratings-and-factor-grades-faq)
- [Seeking Alpha RapidAPI](https://rapidapi.com/apidojo/api/seeking-alpha)
- [OpenBB Seeking Alpha Package](https://pypi.org/project/openbb-seeking-alpha/)
