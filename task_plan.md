# Task Plan: EverInvests Implementation

## Goal
Build a complete market signal broadcast site with automated daily signals for Crypto, Forex, and Stocks.

## Current Phase
**Analysis: Indicator Confluence Design (First Principles)**

- Pages: https://everinvests.com
- Worker: https://everinvests-worker.duyuefeng0708.workers.dev

### Status (2026-01-21)
- **Free Tier: FULLY OPERATIONAL**
- **Analysis: IN PROGRESS** - Thinking through indicator confluence from first principles

---

## Indicator Confluence Analysis (2026-01-21) - COMPLETE

### The Problem Statement
User asks: "vs_20d alone would not say much, need a combo of similar indicators do you think you should get from data source or calculate in the codebase considering rate limit of sources"

### Solution Implemented
**Answer:** Calculate locally using existing data (zero extra API calls)

#### New 3-Indicator Confluence Model
| Indicator | Source | Interpretation |
|-----------|--------|----------------|
| **Trend** | Price vs MA20 | Position in trend (above/below) |
| **Momentum** | MA10 vs MA20 | Trend acceleration (crossover) |
| **Strength** | RSI/Funding | Overbought/oversold |

**Bias rule:** 2+ of 3 signals agree → that direction, else Neutral

### Implementation Complete
- [x] Phase 1: Identify Candidate Indicators
- [x] Phase 2: First-Principles Analysis
- [x] Phase 3: Implement Solution

#### Files Changed:
- `worker/src/types.ts` - Added ma10, maCrossover, indicators
- `worker/src/data/twelvedata.ts` - Calculate MA10 from time_series
- `worker/src/data/binance.ts` - Calculate MA10 from OHLC data
- `worker/src/signals/bias.ts` - 3-indicator confluence logic
- `worker/src/storage/d1.ts` - Store in data_json
- `src/components/AssetTable.astro` - MA crossover column
- `src/pages/api/v1/signals.ts` - Parse new format
- `mcp-server/src/index.ts` - Updated output format

#### Verification:
- TypeScript: ✅ All checks pass
- Tests: ✅ 87/87 passing
- Build: ✅ Frontend builds successfully

**Ready for deployment.**

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
