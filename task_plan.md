# Task Plan: EverInvests Implementation

## Goal
Build a complete market signal broadcast site with automated daily signals for Crypto, Forex, and Stocks.

## Current Phase
**Tier 1 IC Fixes - IN PROGRESS**

---

## Tier 1 IC Fixes (2026-01-21) - COMPLETE

### Problem Statement
Agent critique revealed we're using wrong indicators for each asset class:
- Forex: RSI is meaningless (forex trends, doesn't oscillate)
- Crypto: 20D MA too slow for 24/7 market, F&G not per-asset
- All: DXY strength not linked to forex bias

### Tier 1 Tasks (Zero API cost, high impact)

| Task | Status | IC Gain |
|------|--------|---------|
| 1. Forex: Replace RSI with yield curve signal | ✅ complete | +15-25% |
| 2. Forex: Link DXY strength to USD pair bias | ✅ complete | +15-20% |
| 3. Crypto: F&G per-asset override | ✅ complete | +10-15% |
| 4. Crypto: Use 7D MA instead of 20D | ✅ complete | +5-10% |
| 5. Update tests and verify consistency | ✅ complete | - |
| 6. Build, test, deploy | ✅ complete | - |

### Implementation Details

**Forex yield curve signal:**
- Replaced RSI strength with yield curve interpretation
- Inverted curve → bearish (risk-off)
- Normal curve → bullish (risk-on)
- Flat → neutral

**DXY link to forex:**
- USD/JPY, USD/CAD: Strong DXY → bullish (USD appreciates)
- EUR/USD, AUD/USD: Strong DXY → bearish (inverse pairs)
- Replaces volume signal for forex (no meaningful OTC volume)

**Crypto F&G per-asset:**
- F&G used directly for crypto strength signal
- F&G < 30 → bullish (fear = buying opportunity)
- F&G > 70 → bearish (greed = selling opportunity)

**Crypto 7D MA:**
- Crypto now uses 7D MA (faster mean-reversion for 24/7 market)
- Field still named "ma20" for API compatibility

### Files Changed
- `worker/src/signals/bias.ts` - Asset-class specific indicators, BiasContext
- `worker/src/skills/computeBias.ts` - v3 with macroData pass-through
- `worker/src/skills/fetchMacroData.ts` - Export macroData
- `worker/src/workflows/category.ts` - Pass macroData to bias
- `worker/src/data/binance.ts` - 7D MA for crypto
- `worker/src/signals/index.ts` - Export BiasContext

### Verification
- Crypto reasoning now shows: "Trend: X, Volume: X, Strength: bullish" (F&G-based)
- Forex reasoning now shows: "Trend: X, DXY: X, Strength: bullish" (yield curve)
- Tests: 87/87 passing
- Deployed: Live on everinvests.com

---

## Previous Phase: Volume-Based Independent Metrics - COMPLETE

- Pages: https://everinvests.com
- Worker: https://everinvests-worker.duyuefeng0708.workers.dev

### Status (2026-01-21)
- **Free Tier: FULLY OPERATIONAL**
- **Volume Model: DEPLOYED** - Truly independent indicator confluence

---

## Volume-Based Independent Metrics (2026-01-21) - COMPLETE

### The Problem Statement
User asked for truly **independent** metrics, not just price-derived indicators.

### First Principles Analysis
MA10 vs MA20 crossover was NOT truly independent - all price-derived indicators have ~0.7-0.9 correlation.

**Truly independent information sources:**
- Price action (baseline)
- **Volume** (participation/conviction) - HIGH independence
- **Sentiment** (crowd psychology) - HIGH independence
- Flow data (expensive)
- Positioning (expensive)

### Solution Implemented
Replace MA10/MA20 crossover with **Volume** (zero additional API calls!)

#### New 3-Indicator Confluence Model
| Indicator | Source | Interpretation |
|-----------|--------|----------------|
| **Trend** | Price vs MA20 | Position in trend (above/below) |
| **Volume** | Vol vs Avg Vol | Confirms or diverges from trend |
| **Strength** | RSI/Funding | Overbought/oversold |

**Volume logic:**
- High (>1.2x avg) → confirms trend direction
- Low (<0.8x avg) → diverges (weak conviction)
- Normal → neutral

**Bias rule:** 2+ of 3 signals agree → that direction, else Neutral

---

## Enhanced Macro Indicators (2026-01-21) - COMPLETE

### Agent-Driven Analysis
Spawned agents to analyze from first principles what metrics we use and miss.

**Key insight:** Real blind spot was macro regime awareness - we had F&G and yield spread data but weren't using them actively to influence bias.

### Top 3 Additions

| Indicator | Source | Purpose |
|-----------|--------|---------|
| **BBW** | Calculated | Breakout/volatility detection |
| **F&G Contrarian** | Alternative.me | Override at sentiment extremes |
| **Yield Curve** | FRED T10Y2Y | Recession/expansion regime |

### FRED Bridge for Shock Detection

| Series | What It Detects |
|--------|-----------------|
| **DCOILWTICO** | Oil price shocks (tariffs, supply) |
| **T5YIE** | Inflation expectation spikes |

### Files Changed (Enhancement):
- `worker/src/types.ts` - bbWidth, oilPrice, inflationExpectation, stressLevel, yieldCurve, contrarian, shockDetected
- `worker/src/data/binance.ts` - BBW calculation for crypto
- `worker/src/data/twelvedata.ts` - BBW calculation for forex/stocks
- `worker/src/data/freesources.ts` - fetchOilPrice, fetchInflationExpectation
- `worker/src/data/alphavantage.ts` - Fetch oil and inflation from FRED
- `worker/src/signals/macro.ts` - analyzeFearGreed, analyzeYieldCurve, detectShock, calculateStressLevel
- `worker/src/signals/bias.ts` - Contrarian override in calculateCategoryBias
- `worker/src/skills/computeBias.ts` - v2 with macro signal support
- `worker/src/workflows/category.ts` - Bias depends on macro for contrarian

### Verification:
- TypeScript: ✅ All checks pass
- Tests: ✅ 87/87 passing
- Build: ✅ Frontend builds successfully
- Deployed: ✅ Live on everinvests.com
- API shows: BBW, Oil $59.39, Inflation 2.4%, F&G 24 (Fear)

---

## Previous Phases (Complete)

### VIP Bridge: Waitlist Funnel + Expanded Free Sources - COMPLETE
See: `docs/plans/2026-01-20-vip-bridge-design.md` for architecture

### Growth Plan Phases 1-5 - COMPLETE
- Phase 1: Measurement Foundation
- Phase 2: Content Automation
- Phase 3: Social Proof
- Phase 4: Distribution Expansion
- Phase 5: Agent-Native Features (MCP + Structured API)

---

## Key Constraints Reminder
| Source | Limit | Current Usage |
|--------|-------|---------------|
| TwelveData | 800 req/day, 8/min | ~6 calls/run (batch) |
| Alpha Vantage | 25 req/day | ~3 calls/run |
| CoinGecko | Soft limit | ~2 calls/run |
| Binance | None (blocked, using fallback) | 0 |

---

## Notes
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions
- Log ALL errors - they help avoid repetition
