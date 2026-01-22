# Task Plan: EverInvests Implementation

## Current Task: Phase 1 Regime Detection - Economic Calendar (2026-01-22)

### Goal
Implement Phase 1 of 4-phase regime detection: Economic Calendar Event Windows.
Dampen signal confidence during high-impact events (FOMC, CPI, NFP) to reduce false signals.

### Why This Matters
Markets behave erratically around scheduled events. Signals generated during FOMC announcements or CPI releases have lower predictive value. By detecting event windows and dampening signal confidence, we improve overall signal quality.

### Phases Overview
| Phase | Feature | Effort | API Cost | Status |
|-------|---------|--------|----------|--------|
| **1** | Economic Calendar Events | 2h | $0 | `complete` |
| 2 | F&G Extreme Regime | 1.5h | $0 | `pending` |
| 3 | VIX Regime Thresholds | 2h | $0 | `pending` |
| 4 | GDELT Geopolitical | 4h | $0 | `future` |

### Phase 1 Tasks
- [x] Create `worker/src/data/economic-calendar.ts` - Static FOMC/CPI/NFP dates
- [x] Create `worker/src/signals/regime.ts` - Classification logic
- [x] Add regime types to `worker/src/types.ts`
- [x] Update `worker/src/signals/macro.ts` - Integrate regime
- [x] Update `src/components/MacroBar.astro` - Display regime/events
- [x] Test and verify (TypeScript + Build pass)

### Key Files
| File | Change |
|------|--------|
| `worker/src/data/economic-calendar.ts` | NEW: Static calendar + event window logic |
| `worker/src/signals/regime.ts` | NEW: Phase 1 classification |
| `worker/src/types.ts` | ADD: RegimeClassification, EventWindowData |
| `worker/src/signals/macro.ts` | MODIFY: Call classifyRegime() |
| `src/components/MacroBar.astro` | MODIFY: Show regime + upcoming events |

### Design Reference
Full implementation plan: `docs/plans/2026-01-22-regime-detection-implementation.md`

---

## Previous Task: Performance & Credibility Enhancement (2026-01-21) - COMPLETE

Bold messaging update completed. "We ran money. Now we share our edge."

---

## Previous Phases (All Complete)

### Tier 2 IC Fixes - PARTIAL
- Relative strength for stocks: Code ready, blocked by TwelveData rate limits

### Tier 1 IC Fixes - COMPLETE
- Forex: Yield curve + DXY linkage
- Crypto: F&G per-asset, 7D MA

### Volume-Based Independent Metrics - COMPLETE
- Trend + Volume + Strength model deployed

### Enhanced Macro Indicators - COMPLETE
- BBW, F&G contrarian, yield curve

### VIP Bridge - COMPLETE
- Waitlist funnel on all pages

### Phase 5: Agent-Native Features - COMPLETE
- MCP Server + v1 API deployed

---

## Key Constraints Reminder
| Source | Limit | Current Usage |
|--------|-------|---------------|
| TwelveData | 800 req/day, 8/min | ~6 calls/run (batch) |
| Alpha Vantage | 25 req/day | ~3 calls/run |
| CoinGecko | Soft limit | ~2 calls/run |
