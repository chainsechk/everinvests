# Apex Intelligence Network Design Document

**Date:** 2026-01-20
**Status:** Draft
**Version:** 3.1
**Baseline:** EverInvests v1.0 (operational free broadcast site with skill-based pipeline)

---

## Executive Summary

This document defines the **incremental evolution** from EverInvests (free broadcast) to Apex Intelligence Network (paid subscription). The design preserves all existing infrastructure and adds new capabilities through:

1. **New skills** that plug into the existing DAG pipeline
2. **Type extensions** (Regime builds on Bias, doesn't replace)
3. **Separate bot worker** for user interactions (signal worker unchanged)
4. **Additive database tables** (no breaking schema changes)

**Evolution Strategy: Preserve → Extend → Enhance**
- Phase 1: Add users/subscriptions + tiered delivery (existing signals, new routing)
- Phase 2: Add Regime Engine skill (enhances existing bias with confidence + invalidation)
- Phase 3: Add real-time alerts + execution scaffold

**Key Differentiators:**
1. **Regime Engine** (8 market states) extending existing 3-state Bias
2. **Directive Translator** (actionable parameters from regime)
3. **Confidence + Invalidation** (when to trust/distrust signals)
4. **Evidence Chain** (every directive traceable to data)
5. **Tiered Delivery** (same signals, different formatting/depth)

---

## 0. Integration Analysis: Current → Target

### 0.1 What We Keep (Reuse 100%)

| Component | Location | Why Keep |
|-----------|----------|----------|
| Skill pipeline pattern | `worker/src/pipeline.ts` | Proven orchestration, error handling, observability |
| fetchMacroData skill | `worker/src/skills/fetchMacroData.ts` | DXY/VIX/10Y still core inputs |
| fetchAssetData skill | `worker/src/skills/fetchAssetData.ts` | Price/MA/RSI still core inputs |
| computeBias skill | `worker/src/skills/computeBias.ts` | Bias becomes input to Regime Engine |
| qualityChecks skill | `worker/src/skills/qualityChecks.ts` | Quality flags feed confidence score |
| generateSummary skill | `worker/src/skills/generateSummary.ts` | LLM layer with provenance tracking |
| storeSignal skill | `worker/src/skills/storeSignal.ts` | D1 persistence + delta computation |
| TTL cache | `worker/src/cache/ttl.ts` | Rate limit protection |
| Types | `worker/src/types.ts` | Extend, don't replace |
| D1 schema | `migrations/0001-0004` | Add tables, don't modify |

### 0.2 What We Extend (Enhance Existing)

| Component | Current | Extension |
|-----------|---------|-----------|
| `Bias` type | `Bullish \| Bearish \| Neutral` | Add `Regime` type that wraps Bias + confidence |
| `MacroSignal` | DXY, VIX, 10Y | Add optional `derivatives` field (skew, IV) |
| `AssetSignal` | Per-asset bias | Add optional `regime_contribution` score |
| `notifyTelegram` skill | Single channel broadcast | Becomes `deliverSignal` with tier routing |
| `output_json` in signals table | summary, levels, risks | Add `regime`, `directive`, `invalidation` |

### 0.3 What We Add (New Components)

| Component | Purpose | Integration Point |
|-----------|---------|-------------------|
| **New Skill: fetchDerivativesData** | Deribit skew/IV | Runs parallel to fetchMacroData |
| **New Skill: computeRegime** | 8-state classifier | Runs after computeBias, uses bias + macro + derivatives |
| **New Skill: translateDirective** | Actionable params | Runs after computeRegime |
| **New Skill: routeDelivery** | Tier-based formatting | Replaces notifyTelegram |
| **New Worker: bot-worker** | Telegram commands | Separate from signal-worker |
| **New Tables: users, subscriptions** | User management | D1 migration 0005 |
| **New Table: regimes** | Regime history | D1 migration 0006 |

### 0.4 Evolved Pipeline DAG

**Current (7 skills):**
```
macro ──┬─→ quality ──┐
        │             │
assets ─┼─→ bias ─────┼─→ summary ──→ store ──→ notify
        │             │
        └─────────────┘
```

**Target (10 skills):**
```
macro ──────┬─→ quality ──┐
            │             │
derivatives ┤             │
            │             │
assets ─────┼─→ bias ─────┼─→ regime ──→ directive ──→ summary ──→ store ──→ route
            │             │
            └─────────────┘
```

### 0.5 Type Evolution

```typescript
// CURRENT (keep as-is)
type Bias = 'Bullish' | 'Bearish' | 'Neutral';

// NEW (extends existing)
type RegimeType =
  | 'BULL_TREND'
  | 'BULL_VOLATILE'
  | 'ACCUMULATION'
  | 'DISTRIBUTION'
  | 'BEAR_VOLATILE'
  | 'BEAR_TREND'
  | 'VOL_EXPANSION'
  | 'VOL_COMPRESSION';

interface Regime {
  type: RegimeType;
  baseBias: Bias;           // Links to existing bias
  confidence: number;        // 0.0 - 1.0
  evidence: EvidenceChain;
  invalidation: InvalidationConditions;
}

interface Directive {
  regime: Regime;
  positionSize: string;      // "30-50% of target"
  maxLeverage: number;
  stopLoss: string;          // "-5% from entry"
  entryTiming: string;       // "scale in on dips"
}

// Regime maps to Bias (backwards compatible)
const REGIME_TO_BIAS: Record<RegimeType, Bias> = {
  BULL_TREND: 'Bullish',
  BULL_VOLATILE: 'Bullish',
  ACCUMULATION: 'Bullish',
  DISTRIBUTION: 'Bearish',
  BEAR_VOLATILE: 'Bearish',
  BEAR_TREND: 'Bearish',
  VOL_EXPANSION: 'Neutral',
  VOL_COMPRESSION: 'Neutral',
};
```

---

## 1. Product Vision & Positioning

### 1.1 From Broadcast to Subscription

| Aspect | EverInvests (Current) | Apex (Target) |
|--------|----------------------|---------------|
| Model | Free broadcast | Paid subscription |
| Delivery | Website + Telegram channel | Telegram bot (primary) |
| Content | Daily bias signals | Regime + Directives + Risk Ladder |
| Personalization | None | User preferences, risk profile |
| Execution | None | Optional Freqtrade integration |
| Revenue | $0 (funnel to premium) | $49-399/user/month |

### 1.2 Competitive Positioning (2x2 Matrix)

**High Insight / Low Execution (Research)**
- Delphi Pro ($199-499/mo)
- Messari Pro
- Glassnode Studio ($49/mo)

**Low Insight / High Execution (Tools)**
- 3Commas ($29-99/mo)
- Telegram trading bots (Unibot, Maestro)
- Freqtrade (open source)

**High Insight / High Execution (Apex Target Zone)**
- Institutional platforms (expensive, complex)
- NOFX (open source AI trading OS)
- **Apex differentiator: Regime Engine + Verifiable Signals + Telegram UX**

### 1.3 Target Users (ICP)

**Tier 1: Part-Time Trader ($49-99/mo)**
- Pain: Knows macro matters, no time to analyze daily
- Value: "Today's regime + what to do + risk parameters"
- Behavior: Checks signals 1-2x daily, trades manually

**Tier 2: Semi-Professional ($149-399/mo)**
- Pain: Wants portfolio-level risk control, not just signals
- Value: Real-time alerts + risk ladder + semi-auto execution
- Behavior: Multiple positions, wants systematic approach

**Tier 3: Systematic Trader (Future)**
- Pain: Has strategies but needs macro regime gating
- Value: Freqtrade integration + audit logs
- Behavior: Automated execution with human oversight

---

## 2. Signal Architecture Evolution

### 2.1 Current Signal Logic (Keep + Extend)

```
CURRENT PIPELINE (worker/src/skills/computeBias.ts):

Input:
  ├─ assetData[]: { price, ma20, secondaryIndicator }
  └─ category: crypto | forex | stocks

Processing (2-of-2 voting per asset):
  ├─ MA Signal: price > ma20*1.01 → bullish, < ma20*0.99 → bearish
  ├─ Secondary Signal:
  │   ├─ crypto: funding < 0.01% → bullish, > 0.05% → bearish
  │   └─ forex/stocks: RSI < 30 → bullish, > 70 → bearish
  └─ Asset Bias: 2 bullish → Bullish, 2 bearish → Bearish, else Neutral

Category Aggregation (majority vote):
  └─ bullishCount > total/2 → Bullish, bearishCount > total/2 → Bearish

Output:
  ├─ categoryBias: Bias
  ├─ assetSignals[]: { ticker, bias, vsMA20, secondaryInd, reasoning }
  ├─ levels: { btc_price, eth_price, ... }
  └─ risks: string[]

✅ THIS LOGIC STAYS UNCHANGED
✅ Regime Engine CONSUMES this output, doesn't replace it
```

### 2.2 Phase 1: Confidence-Enhanced Bias (MVP)

**Key Insight:** The 8-regime taxonomy is intellectually appealing but unproven. For MVP, we achieve 80% of user value with 20% of complexity by adding:

1. **Confidence Score** - How much to trust this signal
2. **Invalidation Levels** - When the signal would flip
3. **Watch Alerts** - What to monitor

```
PHASE 1 ENHANCEMENT (minimal changes to existing pipeline):

Input (all existing):
  ├─ bias: Bias                    ← from computeBias (existing)
  ├─ assetSignals[]: AssetSignal[] ← from computeBias (existing)
  ├─ macroSignal: MacroSignal      ← from fetchMacroData (existing)
  └─ qualityFlags: QualityFlags    ← from qualityChecks (existing)

Processing (simple scoring):
  ├─ Step 1: Calculate confidence (0.3-0.95)
  │   ├─ Base: 0.5
  │   ├─ +0.15 if macro.overall aligns with bias
  │   │   (Risk-on + Bullish, or Risk-off + Bearish)
  │   ├─ +0.1 if all assets agree with category bias
  │   ├─ +0.1 if funding rate supports direction (crypto)
  │   ├─ -0.1 per quality flag (missing_assets, stale_data)
  │   └─ Clamp to [0.3, 0.95]
  │
  └─ Step 2: Define invalidation levels (price-based)
      ├─ Bullish: "Invalidates if BTC < ${MA20 * 0.97}" (3% below MA)
      ├─ Bearish: "Invalidates if BTC > ${MA20 * 1.03}" (3% above MA)
      └─ Neutral: "Watch for VIX move outside 18-25"

Output (extends existing output_json):
  ├─ bias: Bias                    // existing
  ├─ summary: string               // existing
  ├─ confidence: number            // NEW
  ├─ invalidation: string          // NEW (human-readable)
  └─ watchLevels: {                // NEW
       btc_invalidation: number,
       eth_invalidation: number,
       vix_alert: string
     }
```

**TypeScript Interface:**
```typescript
// Extends existing CategorySignal
interface EnhancedSignal extends CategorySignal {
  confidence: number;           // 0.3-0.95
  invalidation: string;         // "Invalidates if BTC < $41,200"
  watchLevels: {
    btc_invalidation?: number;
    eth_invalidation?: number;
    vix_alert?: string;
  };
}
```

**Why This Works for MVP:**
- Adds clear value (confidence, invalidation) without new data sources
- Stays within 10ms CPU budget (simple arithmetic)
- No new skills required - just extend `computeBias` output
- Tier 1 users see confidence + invalidation; Free users see just bias

### 2.3 Phase 2+: Full Regime Engine (Post-Launch)

**Only implement after:**
- [ ] 50+ paying subscribers validate demand
- [ ] Deribit API tested from CF Workers (may need proxy)
- [ ] User feedback confirms regime complexity is wanted

```
PHASE 2 ENHANCEMENT (adds derivatives + regime taxonomy):

Additional Input:
  └─ derivatives?: DerivativesData ← from fetchDerivativesData (NEW)
      ├─ btcSkew25d: number        // Deribit 25-delta skew
      ├─ btcAtmIv: number          // ATM implied volatility
      └─ dataTimestamp: string

Processing:
  ├─ Step 1: Determine volatility state from IV
  │   ├─ IV > 0.8 → HIGH_VOL
  │   ├─ IV < 0.4 → LOW_VOL
  │   └─ else → NORMAL_VOL (or use VIX if no IV)
  │
  ├─ Step 2: Map to 8-regime taxonomy
  │   (See Section 2.4 for full mapping)
  │
  └─ Step 3: Generate directive from regime
      (Position sizing, leverage, stop-loss guidance)

Output:
  ├─ regime: RegimeType            // 8 states
  ├─ confidence: number
  ├─ directive: Directive          // Actionable parameters
  └─ evidence: EvidenceChain       // Full signal breakdown
```

### 2.3 Regime Taxonomy (8 States with Bias Mapping)

| Regime | Base Bias | Vol State | Typical Conditions |
|--------|-----------|-----------|-------------------|
| BULL_TREND | Bullish | Low | Clear uptrend, VIX < 20, funding normal |
| BULL_VOLATILE | Bullish | High | Uptrend but choppy, VIX > 25 |
| ACCUMULATION | Bullish | Normal | Range-bound, bullish bias, preparing up |
| DISTRIBUTION | Bearish | Normal | Range-bound, bearish bias, preparing down |
| BEAR_VOLATILE | Bearish | High | Downtrend, VIX > 25, panic selling |
| BEAR_TREND | Bearish | Low | Clear downtrend, capitulation |
| VOL_EXPANSION | Neutral | High | Breakout forming, direction unclear |
| VOL_COMPRESSION | Neutral | Low | Consolidation, await catalyst |

**Backwards Compatibility:**
```typescript
// Regime always has a base Bias for legacy systems
function getBaseBias(regime: RegimeType): Bias {
  switch (regime) {
    case 'BULL_TREND':
    case 'BULL_VOLATILE':
    case 'ACCUMULATION':
      return 'Bullish';
    case 'BEAR_TREND':
    case 'BEAR_VOLATILE':
    case 'DISTRIBUTION':
      return 'Bearish';
    default:
      return 'Neutral';
  }
}
// Website, free channel still show Bias
// Paid tiers show full Regime
```

### 2.4 Data Sources (Phased Addition)

**Phase 1 (MVP - use existing):**
| Signal | Source | Already Have |
|--------|--------|--------------|
| Price, MA, RSI | TwelveData | ✅ Yes |
| Funding Rate | Binance/CoinGecko | ✅ Yes |
| DXY, VIX, 10Y | TwelveData/AlphaVantage | ✅ Yes |

**Phase 2 (Regime Engine):**
| Signal | Source | Cost | Integration |
|--------|--------|------|-------------|
| 25D Skew | Deribit API | Free | New fetcher skill |
| ATM IV | Deribit API | Free | Same fetcher |

**Phase 3+ (Future Enhancement):**
| Signal | Source | Cost | Priority |
|--------|--------|------|----------|
| SSR | Glassnode | $49/mo | Could |
| Coinbase Premium | CryptoQuant/calc | Free | Could |
| ETF Flows | Manual | Free | Could |

### 2.3 Regime Taxonomy (8 States)

| Regime | Description | Directive Example |
|--------|-------------|-------------------|
| BULL_TREND | Clear uptrend, low volatility | Full position, no hedge |
| BULL_VOLATILE | Uptrend but choppy | Reduced position, tight stops |
| ACCUMULATION | Range, bullish bias | Scale in on dips |
| DISTRIBUTION | Range, bearish bias | Scale out, prepare shorts |
| BEAR_VOLATILE | Downtrend, high vol | Minimal exposure, hedge |
| BEAR_TREND | Clear downtrend, low vol | No longs, trailing shorts |
| VOL_EXPANSION | Breakout forming | Wait for confirmation |
| VOL_COMPRESSION | Low vol, await catalyst | Small positions, wide stops |

### 2.4 Data Source Mapping

| Signal | Source | Cost | Priority |
|--------|--------|------|----------|
| Price, MA, RSI | TwelveData | Free (800/day) | MUST |
| Funding Rate | Binance Futures | Free | MUST |
| Macro (DXY, VIX, 10Y) | TwelveData/AlphaVantage | Free | MUST |
| **25D Skew** | Deribit API | Free | MUST (Phase 2) |
| **ATM IV** | Deribit API | Free | MUST (Phase 2) |
| **SSR** | Glassnode API | $49/mo or manual | SHOULD |
| **Coinbase Premium** | CryptoQuant or calc | Free/manual | SHOULD |
| ETF Flows | Manual/scrape | Free | COULD |
| Order Book | Kaiko/CoinAPI | $99-499/mo | COULD (Phase 4) |

---

## 3. System Architecture

### 3.1 Two-Worker Model (Key Design Decision)

The evolution uses **two separate workers** to maintain separation of concerns:

| Worker | Trigger | Responsibility | State |
|--------|---------|----------------|-------|
| **signal-worker** (existing) | Cron (hourly) | Generate signals, store to D1, broadcast | Stateless |
| **bot-worker** (new) | Telegram webhook | Handle commands, manage users, route delivery | Reads D1 |

**Why two workers:**
- Signal generation is cron-driven, doesn't need user context
- Bot interactions are event-driven, need user lookup
- Separation allows independent deployment and scaling
- Bot-worker can be added without modifying signal-worker

### 3.1.1 Infrastructure Constraints (Critical)

| Constraint | Current Limit | Impact | Mitigation |
|------------|---------------|--------|------------|
| **Workers CPU** | 10ms/invocation | Regime computation may timeout | Keep Phase 1 simple; defer derivatives to Phase 2 |
| **D1 Replication** | 10-30s lag (global) | Bot may serve stale data | Include `generated_at` in responses; bot checks freshness |
| **Workers AI** | 10k neurons/day | Limits LLM calls | Current usage ~6k (sufficient) |
| **TwelveData** | 800 req/day | Asset data batched | Current batch approach works |
| **Deribit** | IP-based rate limits | May block CF Worker IPs | **Test before implementing**; consider Laevitas fallback |
| **MemberPaywall** | Webhook delivery | Could miss events | Add idempotency + event log table |

### 3.1.2 D1 Consistency Between Workers

**Problem:** Bot-worker may read stale data due to D1 replication lag.

**Solution:**
```typescript
// Signal-worker: store timestamp when writing
await db.prepare(`
  UPDATE signals SET generated_at = ? WHERE id = ?
`).bind(new Date().toISOString(), signalId).run();

// Bot-worker: check freshness before responding
const signal = await getLatestSignal(db, category);
const age = Date.now() - new Date(signal.generated_at).getTime();
if (age > 60000) { // >1 minute old
  // Add "Data may be updating..." disclaimer
}
```

### 3.2 Current Architecture (EverInvests)

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Platform                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐     ┌────────────────────────────────────┐    │
│  │   Cron   │────▶│         signal-worker              │    │
│  │ (hourly) │     │                                    │    │
│  └──────────┘     │  Skills Pipeline (7 skills):       │    │
│                   │  macro → assets → bias → quality   │    │
│                   │       → summary → store → notify   │    │
│                   │                                    │    │
│                   └──────────────┬─────────────────────┘    │
│                                  │                          │
│                   ┌──────────────┼──────────────┐           │
│                   ▼              ▼              ▼           │
│            ┌──────────┐   ┌──────────┐   ┌──────────┐      │
│            │    D1    │   │ Workers  │   │ Telegram │      │
│            │ Database │   │    AI    │   │ Channel  │      │
│            └──────────┘   └──────────┘   │(broadcast│      │
│                   ▲                      └──────────┘      │
│                   │                                        │
│            ┌──────────┐                                    │
│            │  Astro   │                                    │
│            │  Pages   │                                    │
│            └──────────┘                                    │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 3.3 Target Architecture (Apex) - Phased

**Phase 1: Add bot-worker + users (no signal-worker changes)**

```
┌────────────────────────────────────────────────────────────────┐
│                    Cloudflare Platform                          │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐     ┌────────────────────────────────────┐       │
│  │   Cron   │────▶│       signal-worker (unchanged)    │       │
│  │ (hourly) │     │  Same 7 skills, same output        │       │
│  └──────────┘     └──────────────┬─────────────────────┘       │
│                                  │                              │
│                   ┌──────────────┼──────────────┐              │
│                   ▼              ▼              ▼              │
│            ┌──────────┐   ┌──────────┐   ┌──────────┐         │
│            │    D1    │   │ Workers  │   │ Telegram │         │
│            │ Database │   │    AI    │   │ Channel  │         │
│            │          │   └──────────┘   │(broadcast│         │
│            │ +users   │                  └──────────┘         │
│            │ +subs    │                        ▲               │
│            └────┬─────┘                        │               │
│                 │                              │               │
│  ┌──────────┐   │    ┌─────────────────────────┴────────────┐ │
│  │ Telegram │───┼───▶│           bot-worker (NEW)           │ │
│  │ Webhook  │   │    │                                      │ │
│  └──────────┘   │    │  /start → create user, check sub     │ │
│                 │    │  /signal → fetch from D1, format     │ │
│  ┌──────────┐   │    │  /subscribe → redirect to paywall    │ │
│  │MemberPW  │───┼───▶│  webhook → sync subscription         │ │
│  │ Webhook  │   │    │                                      │ │
│  └──────────┘   │    └──────────────────────────────────────┘ │
│                 │                                              │
│            ┌────▼─────┐                                        │
│            │  Astro   │                                        │
│            │  Pages   │                                        │
│            └──────────┘                                        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Phase 2: Add regime skills to signal-worker**

```
┌────────────────────────────────────────────────────────────────┐
│                    Cloudflare Platform                          │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐     ┌────────────────────────────────────┐       │
│  │   Cron   │────▶│       signal-worker (enhanced)     │       │
│  │ (hourly) │     │                                    │       │
│  └──────────┘     │  Skills Pipeline (10 skills):      │       │
│                   │                                    │       │
│                   │  macro ────┬─→ quality ──┐         │       │
│                   │            │             │         │       │
│                   │  derivs ◀──┤             │         │       │
│                   │   (NEW)    │             │         │       │
│                   │            │             │         │       │
│                   │  assets ───┼─→ bias ─────┼─→ regime│       │
│                   │            │             │    (NEW)│       │
│                   │            │             │    │    │       │
│                   │            │             │    ▼    │       │
│                   │            │             │ directive       │
│                   │            │             │    (NEW)│       │
│                   │            │             │    │    │       │
│                   │            └─────────────┴────┼────│       │
│                   │                              ▼    │       │
│                   │         summary ──→ store ──→ route       │
│                   │                              (NEW)│       │
│                   └──────────────┬─────────────────────┘       │
│                                  │                              │
│                   ┌──────────────┼──────────────┐              │
│                   ▼              ▼              ▼              │
│            ┌──────────┐   ┌──────────┐   ┌──────────┐         │
│            │    D1    │   │ Workers  │   │ Tiered   │         │
│            │ +regimes │   │    AI    │   │ Delivery │         │
│            └──────────┘   └──────────┘   └──────────┘         │
│                                                ▲               │
│                                                │               │
│                   ┌────────────────────────────┴────────────┐  │
│                   │           bot-worker                    │  │
│                   │  + /alerts, /status commands           │  │
│                   └─────────────────────────────────────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 3.4 Skill Integration Details

**New Skills and Their Interfaces:**

```typescript
// NEW: fetchDerivativesData skill
// Runs in parallel with fetchMacroData
interface FetchDerivativesInput {
  // no input needed, fetches for crypto only
}
interface FetchDerivativesOutput {
  btcSkew25d: number | null;      // -5 to +5 typically
  btcAtmIv: number | null;        // 0.3 to 1.5 typically
  ethSkew25d: number | null;
  ethAtmIv: number | null;
  dataTimestamp: string;
  isCached: boolean;
  isStale: boolean;
}

// NEW: computeRegime skill
// Runs after computeBias, combines all signals
interface ComputeRegimeInput {
  bias: Bias;                     // from computeBias
  assetSignals: AssetSignal[];    // from computeBias
  macroSignal: MacroSignal;       // from fetchMacroData
  derivatives: FetchDerivativesOutput | null;  // from fetchDerivativesData
  qualityFlags: QualityFlags;     // from qualityChecks
}
interface ComputeRegimeOutput {
  regime: RegimeType;
  confidence: number;
  evidence: {
    biasFactor: number;           // 0.0-1.0 contribution
    macroFactor: number;
    derivativesFactor: number;
    qualityPenalty: number;       // reduces confidence if quality issues
  };
  invalidation: {
    conditions: string[];         // human-readable conditions
    thresholds: Record<string, number>;
  };
}

// NEW: translateDirective skill
// Converts regime to actionable parameters
interface TranslateDirectiveInput {
  regime: ComputeRegimeOutput;
  category: Category;
}
interface TranslateDirectiveOutput {
  positionSize: string;           // "30-50% of target"
  maxLeverage: number;            // 1, 2, 3, etc.
  stopLoss: string;               // "-5% from entry"
  entryTiming: string;            // "immediate" | "scale in" | "wait"
  riskLevel: 'low' | 'medium' | 'high';
}

// EVOLVED: routeDelivery skill (replaces notifyTelegram)
interface RouteDeliveryInput {
  signal: CategorySignal;         // existing signal format
  regime: ComputeRegimeOutput;
  directive: TranslateDirectiveOutput;
  delta: SignalDelta | null;
}
interface RouteDeliveryOutput {
  freeChannelSent: boolean;
  tier1UsersSent: number;
  tier2UsersSent: number;
  errors: string[];
}
```

### 3.5 Database Integration (Additive Only)

**Migration 0005_users_subscriptions.sql:**
```sql
-- No changes to existing tables
-- Only ADD new tables

CREATE TABLE users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id     TEXT NOT NULL UNIQUE,
  telegram_name   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  risk_profile    TEXT DEFAULT 'moderate',
  categories      TEXT DEFAULT '["crypto"]',
  language        TEXT DEFAULT 'en'
);

CREATE TABLE subscriptions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  tier            TEXT NOT NULL DEFAULT 'free',
  status          TEXT NOT NULL DEFAULT 'active',
  provider        TEXT,
  provider_sub_id TEXT,
  started_at      TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at      TEXT,
  UNIQUE(user_id, tier)
);

CREATE INDEX idx_users_telegram ON users(telegram_id);
CREATE INDEX idx_subs_user_status ON subscriptions(user_id, status);
```

**Migration 0006_regimes.sql:**
```sql
-- Links to existing signals table
CREATE TABLE regimes (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  signal_id         INTEGER NOT NULL REFERENCES signals(id),
  regime_type       TEXT NOT NULL,
  confidence        REAL NOT NULL,
  evidence_json     TEXT NOT NULL,
  directive_json    TEXT NOT NULL,
  invalidation_json TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(signal_id)
);

CREATE INDEX idx_regimes_signal ON regimes(signal_id);
```

---

## 4. Telegram Bot Design

### 4.1 Bot Architecture

```
User Message/Action
        │
        ▼
┌───────────────────┐
│ Telegram Bot API  │
│ (Webhook)         │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│ Bot Worker        │
│ (CF Worker)       │
│                   │
│ ┌───────────────┐ │
│ │ Auth Layer    │ │  ← Verify user, check subscription
│ └───────┬───────┘ │
│         │         │
│ ┌───────▼───────┐ │
│ │ Command Router│ │  ← Route to handlers
│ └───────┬───────┘ │
│         │         │
│ ┌───────▼───────┐ │
│ │ Response Gen  │ │  ← Format response by tier
│ └───────────────┘ │
└───────────────────┘
```

### 4.2 Bot Commands

| Command | Description | Access |
|---------|-------------|--------|
| `/start` | Onboarding + subscription check | All |
| `/signal [category]` | Latest regime + directive | Tier 1+ |
| `/status` | Current portfolio state | Tier 2+ |
| `/alerts` | Manage alert preferences | Tier 2+ |
| `/pause` | Pause execution (if enabled) | Tier 2+ |
| `/kill` | Emergency stop all | Tier 2+ |
| `/help` | Command list | All |
| `/subscribe` | Link to MemberPaywall | Free |

### 4.3 Tiered Content Delivery

**Free Channel (Public)**
```
📊 CRYPTO | 2026-01-20 16:00 UTC

Regime: BULL_VOLATILE (0.72)

Direction: Bullish with caution
Key Watch: Skew elevated, funding normalizing

🔗 Full directive: [Subscribe to Apex]
```

**Tier 1 ($49-99/mo)**
```
📊 CRYPTO SIGNAL | 2026-01-20 16:00 UTC

═══════════════════════════════
REGIME: BULL_VOLATILE
Confidence: 0.72
═══════════════════════════════

📈 DIRECTIVE:
• Position: 30-50% of target
• Max Leverage: 2x
• Stop-Loss: -5% from entry
• Entry: Scale in on dips

📊 EVIDENCE:
• 25D Skew: +2.1% (bullish lean)
• Funding: 0.01% (neutral)
• Price vs MA: +4.2% above
• VIX: 18.5 (risk-on)

⚠️ INVALIDATION:
• If skew > +5% (overcrowded)
• If funding > 0.05% (overleveraged)

🔗 everinvests.com/crypto/2026-01-20/16-00
```

**Tier 2 ($149-399/mo)**
```
[Tier 1 content +]

🔔 REAL-TIME ALERTS: ON
• Regime change: Immediate
• Threshold breach: Immediate
• Daily digest: 23:00 UTC

⚙️ EXECUTION STATUS:
• Mode: Semi-auto
• Pending: 1 order awaiting approval
• Active positions: 2

[Approve Order] [View Positions] [Pause]
```

### 4.4 Inline Keyboards

**Signal Message (Tier 1)**
```
[📊 View Chart] [📜 History] [🔔 Set Alert]
```

**Signal Message (Tier 2)**
```
[📊 View Chart] [📜 History] [🔔 Set Alert]
[✅ Execute] [⏸️ Skip This] [⚙️ Modify]
```

**Execution Confirmation**
```
⚠️ Confirm Execution

BTC/USDT Long
• Size: $1,000 (30% of limit)
• Leverage: 2x
• Stop-Loss: $42,500 (-5%)
• Take-Profit: $47,250 (+10%)

[✅ Confirm] [❌ Cancel] [📝 Modify]
```

---

## 5. Database Schema Evolution

### 5.1 New Tables

```sql
-- User identity and preferences
CREATE TABLE users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id     TEXT NOT NULL UNIQUE,
  telegram_name   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  -- Preferences
  risk_profile    TEXT DEFAULT 'moderate',   -- conservative/moderate/aggressive
  categories      TEXT DEFAULT '["crypto"]', -- JSON array
  language        TEXT DEFAULT 'en',
  timezone        TEXT DEFAULT 'UTC',
  -- Execution settings (Tier 2)
  execution_mode  TEXT DEFAULT 'manual',     -- manual/semi-auto/auto
  max_position    REAL DEFAULT 1000,         -- USD
  max_leverage    INTEGER DEFAULT 1,
  -- API keys (encrypted, Tier 2)
  exchange_key_enc TEXT,
  exchange_secret_enc TEXT
);

-- Subscription tracking
CREATE TABLE subscriptions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  tier            TEXT NOT NULL,             -- free/tier1/tier2
  status          TEXT NOT NULL,             -- active/expired/cancelled
  provider        TEXT NOT NULL,             -- memberpaywall/stripe/manual
  provider_sub_id TEXT,
  started_at      TEXT NOT NULL,
  expires_at      TEXT,
  amount_cents    INTEGER,
  currency        TEXT DEFAULT 'USD',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT
);

-- Alert preferences
CREATE TABLE alerts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  category        TEXT NOT NULL,
  alert_type      TEXT NOT NULL,             -- regime_change/threshold/daily_digest
  enabled         BOOLEAN DEFAULT 1,
  config_json     TEXT,                      -- threshold values, etc.
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Execution audit log
CREATE TABLE execution_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  signal_id       INTEGER REFERENCES signals(id),
  action          TEXT NOT NULL,             -- order_placed/order_filled/order_cancelled/stop_triggered
  exchange        TEXT,
  symbol          TEXT,
  side            TEXT,                      -- long/short
  size_usd        REAL,
  price           REAL,
  leverage        INTEGER,
  status          TEXT NOT NULL,             -- pending/success/failed
  error_msg       TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Regime history (enhanced signals)
CREATE TABLE regimes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  signal_id       INTEGER NOT NULL REFERENCES signals(id),
  regime          TEXT NOT NULL,             -- 8 regime types
  confidence      REAL NOT NULL,
  evidence_json   TEXT NOT NULL,             -- signal breakdown
  directive_json  TEXT NOT NULL,             -- position/leverage/stop guidance
  invalidation_json TEXT,                    -- conditions that flip regime
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX idx_users_telegram ON users(telegram_id);
CREATE INDEX idx_subs_user ON subscriptions(user_id);
CREATE INDEX idx_subs_status ON subscriptions(status, expires_at);
CREATE INDEX idx_alerts_user ON alerts(user_id);
CREATE INDEX idx_exec_user ON execution_log(user_id, created_at);
CREATE INDEX idx_regimes_signal ON regimes(signal_id);
```

### 5.2 Schema Migration Strategy

1. **Phase 1:** Add `users` and `subscriptions` tables (no breaking changes)
2. **Phase 2:** Add `regimes` table, populate from enhanced signal generation
3. **Phase 3:** Add `alerts` table for Tier 2 features
4. **Phase 4:** Add `execution_log` for audit trail

---

## 6. Subscription & Payment Integration

### 6.1 MemberPaywall Integration

MemberPaywall (https://memberpaywall.org/) handles:
- Payment processing (Stripe backend)
- Subscription management
- Access control via Telegram bot

**Integration Flow:**
```
User clicks "Subscribe" in Apex Bot
        │
        ▼
Redirect to MemberPaywall checkout
        │
        ▼
User completes payment
        │
        ▼
MemberPaywall webhook → Apex Worker
        │
        ▼
Apex creates/updates subscription in D1
        │
        ▼
User gains access to tier content
```

**Webhook Payload (expected):**
```json
{
  "event": "subscription.created",
  "data": {
    "telegram_id": "123456789",
    "plan_id": "tier1_monthly",
    "status": "active",
    "expires_at": "2026-02-20T00:00:00Z",
    "amount_cents": 4900,
    "currency": "USD"
  }
}
```

**Webhook Security (Critical):**

1. **Signature Verification:**
```typescript
async function verifyWebhookSignature(request: Request, env: Env): Promise<boolean> {
  const signature = request.headers.get('X-MemberPaywall-Signature');
  if (!signature) return false;

  const rawBody = await request.text();
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(env.MEMBERPAYWALL_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const expected = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  return signature === expected;
}
```

2. **Idempotency Table:**
```sql
CREATE TABLE webhook_events (
  id          INTEGER PRIMARY KEY,
  event_id    TEXT NOT NULL UNIQUE,  -- From MemberPaywall
  event_type  TEXT NOT NULL,
  telegram_id TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT (datetime('now')),
  payload_json TEXT NOT NULL
);
```

3. **Graceful Degradation:**
- Cache active subscriptions in memory (5-minute TTL)
- If MemberPaywall is down, allow existing subscribers to continue for 24 hours
- Log all webhook failures for manual reconciliation

### 6.2 Tier Definitions

| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | Public channel, daily summary only |
| Tier 1 | $49-99/mo | Full regime signals, directives, evidence, weekly recap |
| Tier 2 | $149-399/mo | Tier 1 + real-time alerts, semi-auto execution, audit logs |
| Tier 3 (Future) | TBD | Auto execution, 8% management fee on profits |

---

## 7. Compliance & Risk Controls

### 7.1 Regulatory Considerations

**ESMA (EU) - Investment Recommendations:**
- Every directive must include "research/educational purposes" disclaimer
- Disclose any positions held by Apex operator
- No guaranteed returns or exaggerated claims

**FCA (UK) - Crypto Financial Promotions:**
- "Clear, fair, not misleading" standard
- Risk warnings on all promotional content
- Capital at risk statements

**SEC (US) - Fraud Prevention:**
- Anti-pump-and-dump safeguards
- No fake testimonials or manufactured urgency
- Clear refund policy

### 7.2 Required Disclaimers

**Signal Message Footer (Always):**
```
⚠️ Research only. Not financial advice. Capital at risk.
Apex does not guarantee returns. Past performance ≠ future results.
```

**Execution Confirmation (Tier 2):**
```
⚠️ By confirming, you acknowledge:
• This is automated execution of YOUR strategy
• Apex does not control your funds
• You can lose your entire position
• You have read the risk disclosure
```

### 7.3 Security Requirements

**Telegram Bot Security (per Freqtrade docs):**
- Private chat only (no group control)
- Allowlist of telegram_ids
- Rate limiting on commands
- Audit log for all actions
- Kill-switch with 2FA confirmation

**API Key Handling (Tier 2):**
- Trade-only permissions (no withdrawal)
- Encrypted storage in D1
- Never log plaintext keys
- User can revoke anytime

### 7.4 Error Handling and Resilience

**Bot-Worker Error Handling:**

| Error Type | User Message | Internal Action |
|------------|--------------|-----------------|
| D1 read timeout | "Service busy, try again in 30s" | Log, increment circuit breaker |
| No recent signal | "No signal available for {category}" | Check if scheduled run failed |
| Invalid command | "Unknown command. Try /help" | Track for abuse detection |
| Rate limited | "Please wait {X} seconds" | Track per-user |
| Subscription check fail | Graceful fallback to cached status | Log webhook system health |
| MemberPaywall down | Use cached tier (24h grace) | Alert operator |

**Bot Rate Limiting:**

```typescript
// Per-user rate limits
const RATE_LIMITS = {
  commands_per_minute: 10,
  signal_per_hour: 6,      // Tier 1: 6/hour, Free: 3/hour
  invalid_commands_max: 50, // Block after 50 invalid commands
};

// Implementation using D1
async function checkRateLimit(db: D1Database, telegramId: string, command: string): Promise<boolean> {
  const window = Date.now() - 60000; // 1 minute
  const count = await db.prepare(`
    SELECT COUNT(*) as cnt FROM command_log
    WHERE telegram_id = ? AND timestamp > ?
  `).bind(telegramId, window).first<{cnt: number}>();

  if (count && count.cnt >= RATE_LIMITS.commands_per_minute) {
    return false; // Rate limited
  }

  await db.prepare(`
    INSERT INTO command_log (telegram_id, command, timestamp)
    VALUES (?, ?, ?)
  `).bind(telegramId, command, Date.now()).run();

  return true;
}
```

**Monitoring Alerts (Cloudflare Dashboard):**
- Alert if >3 consecutive signal runs fail
- Alert if bot-worker 5xx rate >5%
- Alert if webhook processing >5s average
- Daily summary of subscription events

---

## 8. Success Metrics

### 8.1 Business Metrics

| Metric | Target (90 days) | Tracking |
|--------|------------------|----------|
| Free channel members | 1,000+ | Telegram API |
| Tier 1 subscribers | 50+ | D1 subscriptions |
| Tier 2 subscribers | 10+ | D1 subscriptions |
| MRR | $5,000+ | D1 + MemberPaywall |
| Churn rate (monthly) | <10% | D1 subscriptions |

### 8.2 Product Metrics

| Metric | Target | Tracking |
|--------|--------|----------|
| Signal accuracy (30d) | >55% | D1 signal_outcomes |
| Regime accuracy | >60% | Manual review + D1 |
| Time-to-value (first signal after sub) | <5 min | D1 timestamps |
| Daily active users (Tier 1+) | >30% of subs | Bot interactions |
| Alert open rate | >40% | Telegram delivery reports |

### 8.3 Quality Metrics

| Metric | Target | Tracking |
|--------|--------|----------|
| Directive usefulness rating | >4.0/5 | User feedback |
| False positive rate (alerts) | <20% | User reports |
| Execution success rate | >95% | D1 execution_log |
| Kill-switch usage | <5%/month | D1 execution_log |

---

## 9. Risk Assessment

### 9.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Deribit API rate limits | Medium | High | Cache aggressively, fallback to manual skew |
| MemberPaywall downtime | Low | High | Cache subscription status, grace period |
| Cloudflare Worker limits | Low | Medium | Optimize, upgrade plan if needed |
| LLM quality degradation | Medium | Medium | Validation layer, fallback prompts |

### 9.2 Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Low conversion (free → paid) | Medium | High | A/B test value prop, trial periods |
| Regulatory action | Low | Critical | Conservative disclaimers, legal review |
| Competition (NOFX, etc.) | Medium | Medium | Focus on UX + verifiable signals |
| Churn from poor signals | Medium | High | Accuracy tracking, rapid iteration |

### 9.3 Operational Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| 1-person team burnout | High | Critical | Automate everything, limit scope |
| Support volume | Medium | Medium | FAQ bot, tiered support (Tier 2 priority) |
| Impersonation/scams | Medium | High | Verify bot identity, anti-fraud messaging |

---

## 10. Implementation Roadmap (Realistic 6-Week MVP)

**Core Principle:** Ship revenue-generating MVP first, then add sophistication based on user feedback.

### Phase 1: Bot Infrastructure (Week 1)

**Goal:** Bot responds to commands, creates users

**Tasks:**
1. Create `bot-worker/` scaffolding
2. D1 migration 0005: users, subscriptions, webhook_events tables
3. Implement Telegram webhook handler
4. Add `/start`, `/help` commands
5. Deploy to Cloudflare Workers

**What Changes:**
- New: bot-worker (separate deployment)
- New: D1 tables (additive, no changes to existing)
- Unchanged: signal-worker continues running

**Acceptance:**
- [ ] `/start` creates user in D1 and returns welcome message
- [ ] `/help` shows command list
- [ ] Bot responds within 2 seconds

### Phase 2: Subscription Flow (Week 2)

**Goal:** Users can subscribe and we verify payment

**Tasks:**
1. Implement MemberPaywall webhook (with signature verification)
2. Add idempotency handling for webhooks
3. Implement `/subscribe` command (redirect to paywall)
4. Implement `/signal [category]` command
5. Add tier-based message formatting (Free vs Tier 1)

**What Changes:**
- New: webhook endpoint in bot-worker
- New: formatForTier() functions
- Unchanged: signal-worker

**Acceptance:**
- [ ] `/subscribe` returns payment link with telegram_id
- [ ] Webhook creates subscription in D1
- [ ] `/signal` returns formatted signal based on tier
- [ ] Free users see truncated signal + paywall CTA
- [ ] Tier 1 users see full signal

### Phase 3: Confidence + Invalidation (Week 3)

**Goal:** Add value for Tier 1 without full regime engine

**Tasks:**
1. Extend `computeBias` skill to output confidence score
2. Add invalidation level calculation (price thresholds)
3. Add watchLevels to output_json
4. Update Tier 1 message format to show confidence + invalidation
5. Keep free channel format unchanged

**What Changes:**
- Extended: computeBias skill v3 (adds confidence, invalidation)
- Extended: output_json schema
- Unchanged: pipeline structure, other skills

**Acceptance:**
- [ ] Confidence score 0.3-0.95 appears in output_json
- [ ] Invalidation levels calculated from MA ± 3%
- [ ] Tier 1 messages show "Confidence: 72%" and "Watch: BTC < $41,200"
- [ ] CPU time still within 10ms budget

### Phase 4: Resilience + Polish (Week 4)

**Goal:** Production-ready for paying customers

**Tasks:**
1. Add bot rate limiting (10 commands/min)
2. Add subscription status caching (5-min TTL)
3. Add `/status` command (subscription details)
4. Add graceful error handling for all commands
5. Add command_log table for analytics

**What Changes:**
- New: rate limiting layer in bot-worker
- New: command_log table
- Enhanced: all command handlers with error handling

**Acceptance:**
- [ ] Rate-limited users see friendly message
- [ ] `/status` shows subscription tier and expiry
- [ ] No unhandled errors in bot responses
- [ ] Command usage tracked for analytics

### Phase 5: Beta Launch (Week 5)

**Goal:** Validate with real users

**Tasks:**
1. End-to-end testing with MemberPaywall sandbox
2. Recruit 10 beta users (free Tier 1 access)
3. Monitor error rates and latency
4. Collect feedback on signal format
5. Fix critical issues

**Acceptance:**
- [ ] 10 beta users successfully onboarded
- [ ] Payment flow works end-to-end
- [ ] No critical bugs in 7-day beta period
- [ ] User feedback collected and triaged

### Phase 6: Public Launch (Week 6)

**Goal:** Open subscriptions to public

**Tasks:**
1. Update everinvests.com with subscription CTA
2. Post launch announcement to free Telegram channel
3. Monitor subscription conversions
4. Set up daily revenue tracking
5. Plan Phase 2 based on demand

**Success Metrics:**
- [ ] 5+ Tier 1 subscriptions in first week
- [ ] <5% churn in first month
- [ ] Positive user feedback on confidence/invalidation

### Phase 7+: Advanced Features (Post-Launch, If Validated)

**Only implement after 50+ paying subscribers:**

| Feature | Dependency | Complexity |
|---------|------------|------------|
| Deribit derivatives | Test API from CF Workers first | Medium |
| 8-regime taxonomy | User feedback confirms demand | High |
| Directive translation | Regime engine complete | Medium |
| Real-time alerts | Tier 2 subscribers exist | High |
| Execution scaffold | Legal review + 60% accuracy | Very High |

**Gating Criteria for Phase 7:**
- [ ] 50+ Tier 1 subscribers
- [ ] 60%+ signal accuracy over 30 days
- [ ] Deribit API confirmed working from CF Workers
- [ ] User interviews confirm regime complexity wanted

---

## 11. File Structure Evolution

```
everinvests/
├── src/                      # Astro site (unchanged)
├── worker/                   # Signal generation (extended)
│   ├── src/
│   │   ├── skills/
│   │   │   ├── fetchMacroData.ts      # unchanged
│   │   │   ├── fetchAssetData.ts      # unchanged
│   │   │   ├── fetchDerivativesData.ts # NEW
│   │   │   ├── computeBias.ts         # unchanged
│   │   │   ├── computeRegime.ts       # NEW
│   │   │   ├── translateDirective.ts  # NEW
│   │   │   ├── qualityChecks.ts       # unchanged
│   │   │   ├── generateSummary.ts     # unchanged
│   │   │   ├── storeSignal.ts         # extended (saves regime)
│   │   │   └── routeDelivery.ts       # NEW (replaces notifyTelegram)
│   │   ├── data/
│   │   │   ├── deribit.ts             # NEW
│   │   │   └── ...                    # unchanged
│   │   └── ...
│   └── wrangler.toml
│
├── bot-worker/               # NEW: Telegram bot
│   ├── src/
│   │   ├── index.ts          # Webhook handler
│   │   ├── commands/
│   │   │   ├── start.ts
│   │   │   ├── signal.ts
│   │   │   ├── subscribe.ts
│   │   │   ├── alerts.ts     # Phase 5
│   │   │   └── status.ts     # Phase 6
│   │   ├── webhooks/
│   │   │   └── memberpaywall.ts
│   │   ├── delivery/
│   │   │   ├── formatTier.ts
│   │   │   └── send.ts
│   │   └── db/
│   │       ├── users.ts
│   │       └── subscriptions.ts
│   └── wrangler.toml
│
├── migrations/
│   ├── 0001_init.sql         # unchanged
│   ├── 0002_agent_workflows.sql
│   ├── 0003_accuracy_tracking.sql
│   ├── 0004_blog_posts.sql
│   ├── 0005_users_subscriptions.sql  # NEW
│   ├── 0006_regimes.sql              # NEW
│   └── 0007_alerts.sql               # Phase 5
│
└── docs/plans/
    └── 2026-01-20-apex-design.md     # This document
```

---

## 12. Quick Start Checklist

**Before Phase 1:**
- [ ] Review MemberPaywall API docs
- [ ] Create Telegram bot via @BotFather
- [ ] Get bot token and set webhook URL

**Phase 1 Minimum Viable:**
- [ ] bot-worker deployed and responding to /start
- [ ] users table populated on first interaction
- [ ] /signal returns latest signal from D1

**Revenue Trigger:**
- [ ] First paying subscriber via MemberPaywall
- [ ] Tier 1 user receives enhanced signal format

---

*Document version: 3.1*
*Strategy: Preserve → Extend → Enhance*
*Last updated: 2026-01-20*
