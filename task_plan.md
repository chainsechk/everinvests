# Task Plan: EverInvests Implementation

## Current Task: All Phases Complete (2026-01-22)

Regime detection system fully implemented (Phases 1-3). Phase 4 (GDELT) is future work.

### Phases Overview
| Phase | Feature | Effort | API Cost | Status |
|-------|---------|--------|----------|--------|
| 1 | Economic Calendar Events | 2h | $0 | `complete` ✓ |
| 2 | F&G Extreme Regime | 1.5h | $0 | `complete` ✓ |
| 3 | VIX Regime Thresholds | 2h | $0 | `complete` ✓ |
| 4 | GDELT Geopolitical | 4h | $0 | `future` |

### Design Reference
Full implementation plan: `docs/plans/2026-01-22-regime-detection-implementation.md`

---

## Completed: Phase 3 Regime Detection - VIX Thresholds (2026-01-22) ✓

Backend already implemented (VixRegimeData type, classifyRegimePhase3, integration).
Added frontend display in MacroBar.astro:
- Added `phase3_vix` to RegimeClassification interface
- Added helper function: `getVixRegimeAlert()`
- Added VIX regime alert UI (shows for crisis/stressed/apathy states)

---

## Completed: Phase 2 Regime Detection - Fear & Greed Extremes (2026-01-22) ✓

Backend already implemented (types, classifyRegimePhase2, integration).
Added frontend display in MacroBar.astro:
- Added `phase2_fearGreed` to RegimeClassification interface
- Added helper functions: `getFearGreedRegimeLabel()`, `getContrarianSignal()`
- Added contrarian alert UI (shows when F&G ≤20 or ≥80)

---

## Completed: Phase 1 Regime Detection - Economic Calendar (2026-01-22) ✓

Implemented event window dampening for FOMC/CPI/NFP.
- Created `worker/src/data/economic-calendar.ts`
- Created `worker/src/signals/regime.ts`
- Added regime types to `worker/src/types.ts`
- Integrated into `macro.ts` and `MacroBar.astro`
- Committed: `508f63c feat: add Phase 1 regime detection with economic calendar`

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
