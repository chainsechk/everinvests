# Task Plan: EverInvests Implementation

## Current Task: Phase 3 Regime Detection - VIX Thresholds (2026-01-22)

### Goal
Implement Phase 3 of 4-phase regime detection: VIX Regime Thresholds.
Add granular VIX classification (apathy/complacent/normal/stressed/crisis) with action recommendations.

### Why This Matters
VIX provides direct measure of market fear. VIX >30 is crisis mode (defensive), VIX <10 is complacency (potential danger). Granular thresholds allow for more nuanced signal dampening.

### Phases Overview
| Phase | Feature | Effort | API Cost | Status |
|-------|---------|--------|----------|--------|
| 1 | Economic Calendar Events | 2h | $0 | `complete` ✓ |
| 2 | F&G Extreme Regime | 1.5h | $0 | `complete` ✓ |
| **3** | VIX Regime Thresholds | 2h | $0 | `pending` |
| 4 | GDELT Geopolitical | 4h | $0 | `future` |

### Phase 3 Tasks
- [ ] Verify VixRegimeData type in `worker/src/types.ts`
- [ ] Verify `classifyRegimePhase3()` in `worker/src/signals/regime.ts`
- [ ] Verify Phase 3 integration in `calculateMacroSignal()`
- [ ] Update `MacroBar.astro` to display VIX regime state
- [ ] Test and verify (TypeScript + Build pass)

### Key Files
| File | Change |
|------|--------|
| `worker/src/types.ts` | VERIFY: VixRegimeData type |
| `worker/src/signals/regime.ts` | VERIFY: classifyRegimePhase3() |
| `src/components/MacroBar.astro` | MODIFY: Show VIX regime alerts |

### Design Reference
Full implementation plan: `docs/plans/2026-01-22-regime-detection-implementation.md`

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
