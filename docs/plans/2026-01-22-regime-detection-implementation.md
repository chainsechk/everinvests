# 4-Phase Regime Detection Implementation Plan

> Comprehensive implementation guide for seamless regime detection integration.
> Generated 2026-01-22 from full codebase analysis.

## Executive Summary

The EverInvests codebase already has **90% of the infrastructure** needed for regime detection. The system currently has:
- Price-based macro indicators (DXY, VIX, Treasury yields)
- Fear & Greed Index integration (already fetched, used for contrarian signals)
- Yield curve spread analysis (recession warning)
- Shock detection logic (oil/inflation spikes)
- Stress level composite score (0-10)

**Missing pieces:**
1. Economic calendar event windows (dampening signals during FOMC/CPI/NFP)
2. Explicit regime classification ("normal" vs "event" vs "stressed" vs "crisis")
3. VIX-based crisis thresholds (>30 = crisis mode)
4. GDELT geopolitical score (future)

---

## Current State: What Already Works

```
✅ DXY Analysis (strong/weak/neutral based on ±1% from MA20)
✅ VIX Thresholds (<12 risk_on, >20 risk_off)
✅ Treasury Yield Analysis (absolute levels + 2Y-10Y spread)
✅ Fear & Greed Index (fetched, contrarian logic at extremes)
✅ Yield Curve Regime (inverted/flat/normal)
✅ Shock Detection (oil spike >5%, inflation >3%)
✅ Stress Level (0-10 composite score)
✅ Overall Classification (Risk-on/Risk-off/Mixed)
```

---

## Phase 1: Economic Calendar Events

**Effort:** ~2 hours | **API Cost:** $0 | **Value:** HIGH

### What It Does
Dampens signal confidence during high-impact economic events (FOMC, CPI, NFP) because markets behave erratically in event windows.

### Implementation

#### 1.1 Create Economic Calendar Data

```typescript
// worker/src/data/economic-calendar.ts

export type EconomicEvent = "FOMC" | "CPI" | "NFP" | "Fed_Speech";

interface EventConfig {
  windowHours: number;  // Hours before/after event
  dampening: number;    // Multiply signal confidence by this
}

const EVENT_CONFIG: Record<EconomicEvent, EventConfig> = {
  FOMC: { windowHours: 24, dampening: 0.5 },
  CPI: { windowHours: 4, dampening: 0.3 },
  NFP: { windowHours: 4, dampening: 0.3 },
  Fed_Speech: { windowHours: 2, dampening: 0.2 },
};

// 2026 Economic Calendar (add dates as needed)
const CALENDAR_2026: Record<string, EconomicEvent[]> = {
  "2026-01-29": ["FOMC"],
  "2026-02-12": ["CPI"],
  "2026-02-07": ["NFP"],
  "2026-03-19": ["FOMC"],
  // ... add rest of year
};

export function getEventsForDate(date: string): EconomicEvent[] {
  return CALENDAR_2026[date] || [];
}

export function isInEventWindow(
  date: string,
  timeSlot: string,
  event: EconomicEvent
): boolean {
  // Check if current time is within windowHours of event
  const events = getEventsForDate(date);
  if (!events.includes(event)) return false;

  const config = EVENT_CONFIG[event];
  // Implementation: check time difference
  return true; // simplified
}

export function getEventDampening(date: string, timeSlot: string): number {
  const events = getEventsForDate(date);
  if (events.length === 0) return 1.0; // No dampening

  // Find minimum dampening (most restrictive)
  let minDampening = 1.0;
  for (const event of events) {
    if (isInEventWindow(date, timeSlot, event)) {
      minDampening = Math.min(minDampening, EVENT_CONFIG[event].dampening);
    }
  }
  return minDampening;
}
```

#### 1.2 Integration Point

**File:** `worker/src/signals/macro.ts`

```typescript
import { getEventDampening, getEventsForDate } from '../data/economic-calendar';

export function calculateMacroSignal(data: MacroData, date: string, timeSlot: string): MacroSignal {
  // ... existing logic ...

  // NEW: Add event regime
  const eventDampening = getEventDampening(date, timeSlot);
  const activeEvents = getEventsForDate(date);

  return {
    dxyBias,
    vixLevel,
    yieldsBias,
    overall,
    // ... existing fields ...

    // NEW: Regime fields
    regime: {
      classification: eventDampening < 1.0 ? "event" : "normal",
      signalDampening: eventDampening,
      phase1_event: activeEvents.length > 0 ? {
        event: activeEvents[0],
        active: eventDampening < 1.0,
        dampening: eventDampening,
      } : undefined,
    }
  };
}
```

---

## Phase 2: Fear & Greed Regime Classification

**Effort:** ~1.5 hours | **API Cost:** $0 | **Value:** MEDIUM

### What It Does
Classifies F&G extremes as explicit regime states (extreme_fear/extreme_greed) with contrarian implications.

### Current State
Already implemented in `macro.ts`:
```typescript
function analyzeFearGreed(value: number | undefined) {
  if (value === undefined) return { signal: undefined, contrarian: undefined };

  if (value <= 20) return { signal: "extreme_fear", contrarian: "bullish" };
  if (value <= 35) return { signal: "fear", contrarian: undefined };
  if (value >= 80) return { signal: "extreme_greed", contrarian: "bearish" };
  if (value >= 65) return { signal: "greed", contrarian: undefined };
  return { signal: "neutral", contrarian: undefined };
}
```

### Enhancement Needed
Integrate into regime classification:

```typescript
// In regime.ts
export function classifyRegimePhase2(fearGreed: number | undefined): FearGreedRegimeData | undefined {
  if (fearGreed === undefined) return undefined;

  if (fearGreed <= 20) {
    return {
      regime: "extreme_fear",
      value: fearGreed,
      contrarian: true,
      confidence: 0.85
    };
  }
  if (fearGreed >= 80) {
    return {
      regime: "extreme_greed",
      value: fearGreed,
      contrarian: true,
      confidence: 0.85
    };
  }
  return {
    regime: "neutral",
    value: fearGreed,
    contrarian: false,
    confidence: 0.5
  };
}
```

---

## Phase 3: VIX Regime Thresholds

**Effort:** ~2 hours | **API Cost:** $0 | **Value:** MEDIUM

### What It Does
Adds granular VIX regime classification with action recommendations.

### Current State
Only binary classification in `macro.ts`:
```typescript
function analyzeVIX(vix: number): "risk_on" | "risk_off" | "neutral" {
  if (vix < 12) return "risk_on";
  if (vix > 20) return "risk_off";
  return "neutral";
}
```

### Enhancement: Add Crisis/Complacent Detection

```typescript
// worker/src/signals/regime.ts

export type VixRegimeType = "apathy" | "complacent" | "normal" | "stressed" | "crisis";

export interface VixRegimeData {
  regime: VixRegimeType;
  vixValue: number;
  action: "aggressive" | "normal" | "cautious" | "defensive";
  signalDampening: number;
}

export function classifyRegimePhase3(vix: number): VixRegimeData {
  if (vix > 30) {
    return {
      regime: "crisis",
      vixValue: vix,
      action: "defensive",
      signalDampening: 0.3  // Heavy dampening during crisis
    };
  }
  if (vix > 20) {
    return {
      regime: "stressed",
      vixValue: vix,
      action: "cautious",
      signalDampening: 0.7
    };
  }
  if (vix < 8) {
    return {
      regime: "apathy",
      vixValue: vix,
      action: "cautious",  // Dangerously complacent
      signalDampening: 0.8
    };
  }
  if (vix < 12) {
    return {
      regime: "complacent",
      vixValue: vix,
      action: "normal",
      signalDampening: 1.0
    };
  }
  return {
    regime: "normal",
    vixValue: vix,
    action: "normal",
    signalDampening: 1.0
  };
}
```

### Apply Dampening to Bias Calculation

**File:** `worker/src/skills/computeBias.ts`

```typescript
// After calculating category bias:
let finalConfidence = 1.0;

// Apply Phase 1 event dampening
if (regime?.phase1_event?.active) {
  finalConfidence *= regime.phase1_event.dampening;
}

// Apply Phase 3 VIX dampening
if (regime?.phase3_vix) {
  finalConfidence *= regime.phase3_vix.signalDampening;
}

// Adjust signal confidence
const adjustedBias = {
  ...categoryBias,
  confidence: (categoryBias.confidence || 1.0) * finalConfidence,
  dampened: finalConfidence < 1.0,
  dampeningReason: getDampeningReason(regime),
};
```

---

## Phase 4: GDELT Geopolitical Score (Future)

**Effort:** ~4 hours | **API Cost:** $0 (GDELT is free) | **Value:** MEDIUM

### What It Does
Queries GDELT for geopolitical tension metrics, providing early warning for crisis events.

### Implementation Sketch

```typescript
// worker/src/data/gdelt.ts

const GDELT_KEYWORDS = ["war", "military", "sanctions", "tariffs", "crisis", "conflict"];
const GDELT_API = "https://api.gdeltproject.org/api/v2/doc/doc";

export interface GdeltResult {
  score: number;        // 0-100 aggregated tension
  trend: "rising" | "stable" | "falling";
  topThreats: string[];
  articles: number;     // Number of matching articles
}

export async function fetchGdeltScore(): Promise<GdeltResult> {
  // Query GDELT for geopolitical keywords
  // Aggregate article counts into 0-100 score
  // Compare to 7-day moving average for trend

  // Cache for 24 hours (one call per day)
}
```

### Integration
Add to daily cron job (not per-signal):
```typescript
// worker/src/index.ts - scheduled handler

// At 01:00 UTC daily, fetch GDELT score
if (hour === 1) {
  const gdeltScore = await fetchGdeltScore();
  await storeGdeltScore(db, gdeltScore);
}
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                 REGIME DETECTION PIPELINE                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  PHASE 1                PHASE 2              PHASE 3        │
│  ┌─────────┐           ┌─────────┐          ┌─────────┐    │
│  │Economic │           │Fear &   │          │  VIX    │    │
│  │Calendar │           │ Greed   │          │Thresholds│   │
│  │(static) │           │(already │          │(already │    │
│  │         │           │fetched) │          │fetched) │    │
│  └────┬────┘           └────┬────┘          └────┬────┘    │
│       │                     │                    │          │
│       ▼                     ▼                    ▼          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              REGIME CLASSIFIER                        │  │
│  │  classifyRegime(date, timeSlot, fearGreed, vix)      │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                │
│                            ▼                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  RegimeClassification = {                            │  │
│  │    classification: "stressed",                       │  │
│  │    signalDampening: 0.7,                            │  │
│  │    phase1_event: { event: "FOMC", active: false },  │  │
│  │    phase2_fearGreed: { regime: "fear" },            │  │
│  │    phase3_vix: { regime: "stressed" }               │  │
│  │  }                                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                │
│              ┌─────────────┴─────────────┐                 │
│              ▼                           ▼                 │
│       ┌────────────┐              ┌────────────┐          │
│       │ Store in   │              │ Apply to   │          │
│       │ data_json  │              │ Bias Calc  │          │
│       └────────────┘              └────────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `worker/src/data/economic-calendar.ts` | Static FOMC/CPI/NFP dates + window logic |
| `worker/src/signals/regime.ts` | Core regime classification (phases 1-4) |
| `worker/src/data/gdelt.ts` | GDELT API integration (Phase 4) |

## Files to Modify

| File | Changes |
|------|---------|
| `worker/src/types.ts` | Add `RegimeClassification`, `EventWindowData`, `VixRegimeData` types |
| `worker/src/signals/macro.ts` | Call `classifyRegime()` and attach to MacroSignal |
| `worker/src/skills/fetchMacroData.ts` | Pass date/timeSlot for event window check |
| `worker/src/skills/computeBias.ts` | Apply `signalDampening` to final confidence |
| `src/components/MacroBar.astro` | Display regime classification and upcoming events |

---

## Type Definitions

```typescript
// worker/src/types.ts

// Phase 1
export type EconomicEvent = "FOMC" | "CPI" | "NFP" | "Fed_Speech";

export interface EventWindowData {
  event: EconomicEvent;
  active: boolean;
  dampening: number;
}

// Phase 2
export type FearGreedRegime = "extreme_fear" | "fear" | "neutral" | "greed" | "extreme_greed";

export interface FearGreedRegimeData {
  regime: FearGreedRegime;
  value: number;
  contrarian: boolean;
}

// Phase 3
export type VixRegimeType = "apathy" | "complacent" | "normal" | "stressed" | "crisis";

export interface VixRegimeData {
  regime: VixRegimeType;
  vixValue: number;
  action: "aggressive" | "normal" | "cautious" | "defensive";
  signalDampening: number;
}

// Phase 4 (Future)
export interface GdeltRegimeData {
  score: number;
  trend: "rising" | "stable" | "falling";
  topThreats: string[];
}

// Combined
export interface RegimeClassification {
  classification: "normal" | "event" | "stressed" | "crisis";
  signalDampening: number;
  recommendedAction: "aggressive" | "normal" | "cautious" | "defensive";

  phase1_event?: EventWindowData;
  phase2_fearGreed?: FearGreedRegimeData;
  phase3_vix?: VixRegimeData;
  phase4_gdelt?: GdeltRegimeData;
}
```

---

## Backward Compatibility

### No Database Migration Required

All regime data stored in existing `data_json` column:

```typescript
// worker/src/storage/d1.ts - saveMacroSignal()

data_json: JSON.stringify({
  ...rawData,

  // NEW: Regime classification (no schema change)
  regime: regimeClassification,
});
```

### API Response Enhancement

```typescript
// src/pages/api/v1/signals.ts

macro: {
  // Existing fields...

  // NEW: Regime info
  regime: {
    classification: "normal",
    signalDampening: 1.0,
    upcomingEvents: ["FOMC in 3 days"],
  }
}
```

---

## Implementation Priority

| Phase | Effort | API Cost | Value | Priority |
|-------|--------|----------|-------|----------|
| 1: Economic Calendar | 2h | $0 | HIGH | **Implement first** |
| 2: F&G Regime | 1.5h | $0 | MEDIUM | Second |
| 3: VIX Thresholds | 2h | $0 | MEDIUM | Third |
| 4: GDELT | 4h | $0 | MEDIUM | Future |

**Total for Phases 1-3:** ~5.5 hours, $0 API cost

---

## Connection to Premium Architecture

| Free Regime | Premium Weight Profile (from your design) |
|-------------|------------------------------------------|
| COMPLACENT (VIX<12, F&G>80) | Funding contrarian heavy (-1.5) |
| STRESSED (VIX>20, F&G<20) | VRP contrarian (+0.7) |
| EVENT (FOMC/CPI window) | All weights dampened |
| NORMAL | DVOL momentum primary (+1.5) |

The free tier provides **regime classification**.
The premium tier uses this to **adjust signal weights** via your Layer 2 crowding detection and Phase 2 regime-conditional weights.
