# Task Plan: EverInvests Implementation

## Goal
Build a complete market signal broadcast site with automated daily signals for Crypto, Forex, and Stocks.

## Current Phase
**Volume-Based Independent Metrics - COMPLETE**

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

### Files Changed:
- `worker/src/types.ts` - Added volume, avgVolume, volumeSignal
- `worker/src/data/binance.ts` - Fetch from CoinGecko market_chart
- `worker/src/data/twelvedata.ts` - Extract volume from time_series
- `worker/src/signals/bias.ts` - Trend + Volume + Strength model
- `worker/src/storage/d1.ts` - Store volumeSignal in data_json
- `src/components/AssetTable.astro` - Vol column (↑/↓/—)
- `src/pages/api/v1/signals.ts` - Volume indicators in API
- `mcp-server/src/index.ts` - Volume in MCP output (V:C/D/N)

### Verification:
- TypeScript: ✅ All checks pass
- Tests: ✅ 87/87 passing
- Build: ✅ Frontend builds successfully
- Deployed: ✅ Live on everinvests.com

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
