# EverInvests VIP Bridge Design Document

**Date:** 2026-01-20
**Status:** Draft v5.0
**Scope:** Changes to FREE tier (site + TG channel) to funnel users to EverInvests VIP (paid)

**This Repo Handles:** Free site + Free TG channel only
**Separate Project:** EverInvests VIP (paid TG group, edge bot, premium signals)

---

## Executive Summary

This document defines **two distinct tiers** with a clear relationship:

| Product | Channel | Model | Purpose |
|---------|---------|-------|---------|
| **EverInvests** | Website + Free TG Channel | Free | Traffic, SEO, funnel to paid |
| **EverInvests VIP** | Paid TG Group | $49-399/mo | Revenue, full signal stack |

**Key Principle:** EverInvests Free uses a **subset** of VIP's data sources. The free tier demonstrates value without cannibalizing paid.

**Payment Flow:**
1. CTA links to edge bot (e.g., `t.me/EverInvestsVIPBot (TBD)Bot` - TBD)
2. User subscribes via edge bot (powered by MemberPaywall.org)
3. Edge bot generates private invite link to VIP group
4. User joins VIP group

**Note:** VIP group is private - no public link. Edge bot manages subscriptions and generates per-user invite links. Bot setup pending.

---

## 1. Product Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    EVERINVESTS VIP (Paid TG Group)                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    20+ PREMIUM SOURCES                         │  │
│  │  Deribit (IV/skew) │ SSR │ Coinbase Premium │ Order Flow      │  │
│  │  Glassnode │ ETF Flows │ Liquidations │ Vol Surface           │  │
│  └─────────────────────────────┬─────────────────────────────────┘  │
│                                │                                     │
│  ┌─────────────────────────────▼─────────────────────────────────┐  │
│  │                    REGIME ENGINE (8-12 states)                 │  │
│  │  Rules Layer │ ML Classifier │ Multi-Agent Debate              │  │
│  │  AI Agent 1 vs AI Agent 2 vs Human Traders                     │  │
│  └─────────────────────────────┬─────────────────────────────────┘  │
│                                │                                     │
│  ┌─────────────────────────────▼─────────────────────────────────┐  │
│  │                    DIRECTIVE TRANSLATOR                        │  │
│  │  Position │ Leverage │ Stop-Loss │ Invalidation │ Evidence     │  │
│  └─────────────────────────────┬─────────────────────────────────┘  │
│                                │                                     │
│                                ▼                                     │
│                    [ Full Premium Output ]                           │
│                    Regime + Directive + Evidence + Alerts            │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │   SELECT SUBSET FOR     │
                    │   FREE TIER             │
                    └────────────┬────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    EVERINVESTS (Free Site + Free TG)                 │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                    FREE SOURCES ONLY                           │  │
│  │  Binance (price, funding) │ TwelveData │ Alpha Vantage         │  │
│  └─────────────────────────────┬─────────────────────────────────┘  │
│                                │                                     │
│  ┌─────────────────────────────▼─────────────────────────────────┐  │
│  │                    SIMPLE BIAS ENGINE (3 states)               │  │
│  │  Bullish │ Bearish │ Neutral                                   │  │
│  │  No confidence, no invalidation, no directives                 │  │
│  └─────────────────────────────┬─────────────────────────────────┘  │
│                                │                                     │
│                                ▼                                     │
│                    [ Free Output ]                                   │
│                    Bias + Summary + 1 Risk Point + CTA               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Sources Inventory

### 2.1 EverInvests VIP: Full Stack (20+ Sources)

**MUST (MVP for Paid Group):**

| Signal | Source | Cost | Why Essential |
|--------|--------|------|---------------|
| 25D Skew | Deribit API | Free | Risk sentiment, tail hedging demand |
| ATM IV (mark_iv) | Deribit API | Free | Volatility regime |
| Funding Rate | Binance/Exchange APIs | Free | Perps positioning |
| Basis (Perp vs Spot) | Exchange APIs | Free | Leverage sentiment |
| SSR (Stablecoin Supply Ratio) | Glassnode or calc | $49/mo or free calc | Stablecoin buying power |
| Coinbase Premium | CryptoQuant or calc | Free calc | US demand proxy |

**SHOULD (Phase 2):**

| Signal | Source | Cost | Priority |
|--------|--------|------|----------|
| Order Flow Imbalance (OFI) | CoinAPI/Kaiko | $499/mo | High alpha, high cost |
| Full Glassnode Suite | Glassnode Advanced | $49/mo | On-chain depth |
| Open Interest + Liquidations | Exchange APIs | Free | Position crowding |
| Vol Term Structure | Deribit API | Free | Skew dynamics |

**COULD (Phase 3+):**

| Signal | Source | Cost | Notes |
|--------|--------|------|-------|
| ETF Net Flows (BTC/ETH) | Manual/scrape | Free | Institutional demand |
| Vol-of-Vol | Calc from IV | Free | Regime change detector |
| DXY, 2Y/10Y Real Rates | TwelveData/Alpha Vantage | Free | Macro liquidity |
| MSTR/3350.jp Proxy | TwelveData | Free | TradFi crypto beta |
| DEX TVL Changes | DeFiLlama API | Free | Narrative tracking |
| Coin Metrics | Coin Metrics | $$$ | Institutional grade |

### 2.2 EverInvests: Free Subset Only

| Signal | Source | Cost | Constraint |
|--------|--------|------|------------|
| Price, MA20, RSI | TwelveData | Free | 800 req/day |
| Funding Rate | Binance API | Free | Unlimited |
| DXY, VIX, 10Y | TwelveData/Alpha Vantage | Free | 25 req/day (AV) |

**What Free Users DON'T Get:**
- No Deribit skew/IV (premium signal)
- No SSR or Coinbase Premium
- No order flow or liquidation data
- No confidence scores
- No invalidation levels
- No actionable directives
- No evidence chain

---

## 3. Signal Logic Comparison

### 3.1 EverInvests (Free) - Current Logic (Keep As-Is)

```
Input:
  ├─ Price vs MA20 (TwelveData)
  ├─ Funding Rate (Binance)
  ├─ RSI (TwelveData)
  └─ Macro: DXY, VIX, 10Y (Alpha Vantage)

Processing:
  ├─ MA Signal: price > MA20*1.01 → bullish
  ├─ Secondary: funding/RSI thresholds
  └─ 2-of-2 voting per asset

Output:
  ├─ Bias: Bullish | Bearish | Neutral
  ├─ Summary: 1-2 sentences (LLM)
  └─ CTA: "Full analysis at EverInvests VIP"
```

### 3.2 EverInvests VIP - Regime Engine (New System)

```
Input (20+ signals):
  ├─ All free sources (baseline)
  ├─ Deribit: 25D skew, ATM IV, vol surface
  ├─ SSR, Coinbase Premium
  ├─ OI, liquidations, funding extremes
  └─ (Phase 2+) Order flow, ETF flows

Processing:
  ├─ Feature Engineering
  │   ├─ Z-scores, percentiles, rolling stats
  │   ├─ Cross-asset spreads
  │   └─ Vol surface features (skew, fly)
  │
  ├─ Regime Engine
  │   ├─ Rules Layer (hard constraints)
  │   ├─ ML Classifier (soft probabilities)
  │   └─ Multi-Agent Debate
  │       ├─ AI Agent 1 (trend-following bias)
  │       ├─ AI Agent 2 (mean-reversion bias)
  │       └─ Human Trader Override (when disagreement high)
  │
  └─ Directive Translator
      ├─ Position sizing (% of target)
      ├─ Max leverage
      ├─ Stop-loss levels
      ├─ Entry timing
      └─ Invalidation conditions

Output:
  ├─ Regime: 8-12 states (see taxonomy below)
  ├─ Confidence: 0.0-1.0
  ├─ Directive: actionable parameters
  ├─ Evidence Chain: what triggered this
  ├─ Invalidation: when to distrust
  └─ Risk Ladder: conservative/moderate/aggressive params
```

### 3.3 Regime Taxonomy (8-12 States)

| Regime | Description | Base Bias | Directive Archetype |
|--------|-------------|-----------|---------------------|
| BULL_TREND | Clear uptrend, low vol | Bullish | Full position, no hedge |
| BULL_VOLATILE | Uptrend but choppy | Bullish | Reduced size, tight stops |
| ACCUMULATION | Range, bullish bias | Bullish | Scale in on dips |
| DISTRIBUTION | Range, bearish bias | Bearish | Scale out, prepare shorts |
| BEAR_VOLATILE | Downtrend, high vol | Bearish | Minimal exposure, hedge |
| BEAR_TREND | Clear downtrend | Bearish | No longs, trailing shorts |
| VOL_EXPANSION | Breakout forming | Neutral | Wait for confirmation |
| VOL_COMPRESSION | Low vol, await catalyst | Neutral | Small positions, wide stops |
| RISK_OFF_ESCALATION | Skew spike + funding collapse | Bearish | Reduce leverage, hedge |
| RISK_ON_EUPHORIA | Extreme bullish sentiment | Bullish (caution) | Take profits, tighten stops |
| REGIME_CONFLICT | Signals disagree | Neutral | Reduce exposure, wait |
| INVALIDATION | Prior regime failed | - | Exit positions |

### 3.4 Multi-Agent "Fight" Mechanism

```
┌─────────────────────────────────────────────────────────────────┐
│                    MULTI-AGENT DEBATE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ AI Agent 1  │  │ AI Agent 2  │  │ Human Trader│              │
│  │ Trend-      │  │ Mean-       │  │ Override    │              │
│  │ Following   │  │ Reversion   │  │ (discretion)│              │
│  │ Bias        │  │ Bias        │  │             │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         └────────────────┼────────────────┘                      │
│                          │                                       │
│                          ▼                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                 DISAGREEMENT RESOLVER                      │  │
│  │                                                            │  │
│  │  If all agree → High confidence (0.8-0.95)                │  │
│  │  If 2/3 agree → Medium confidence (0.5-0.7)               │  │
│  │  If all disagree → Low confidence, REGIME_CONFLICT        │  │
│  │  If human overrides → Use human + lower confidence        │  │
│  │                                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Free vs Paid Content Comparison

### 4.1 Daily Output Examples

**Free TG Channel (EverInvests):**
```
📊 CRYPTO | 2026-01-20 16:00 UTC

Bias: Bullish

BTC holding above 20D MA with funding normalizing.
Watch: VIX elevated, could reverse on macro shock.

🔗 Full regime + directives: t.me/EverInvestsVIPBot (TBD)
```

**Paid TG Group (VIP Tier 1):**
```
📊 CRYPTO SIGNAL | 2026-01-20 16:00 UTC

═══════════════════════════════════════
REGIME: BULL_VOLATILE
Confidence: 0.72
═══════════════════════════════════════

📈 DIRECTIVE:
• Position: 30-50% of target
• Max Leverage: 2x
• Stop-Loss: -5% from entry
• Entry: Scale in on dips to MA

📊 EVIDENCE:
• 25D Skew: +2.1% (bullish lean, but elevated)
• Funding: 0.01% (neutral, normalizing from 0.05%)
• SSR: 4.2 (above 4 = buying power present)
• Coinbase Premium: +0.3% (US bid present)
• Price vs MA: +4.2% above

⚠️ INVALIDATION:
• If skew > +5% (overcrowded)
• If funding > 0.05% (overleveraged longs)
• If BTC < $41,200 (below MA - 3%)

📉 DISAGREEMENT:
• AI Agent 1: BULL_TREND (0.65)
• AI Agent 2: VOL_EXPANSION (0.55)
• Human: Agrees with Agent 1

⚠️ Research only. Not financial advice. Capital at risk.
```

**Paid TG Group (VIP Tier 2) - adds:**
```
[Tier 1 content +]

🔔 REAL-TIME ALERTS: ON
• Regime change: Immediate
• Skew breach (>5%): Immediate
• Funding breach (>0.05%): Immediate

⚙️ RISK LADDER (your profile: Moderate):
• Suggested position: $1,500 (30% of $5,000 limit)
• Max drawdown before stop: $75 (5%)
• Semi-auto execution: Ready

[Approve Execution] [Modify Params] [Skip]
```

### 4.2 What Creates Upgrade Pressure

| Free Gets | Paid Gets | Upgrade Trigger |
|-----------|-----------|-----------------|
| Bias only | Regime + confidence | "How confident should I be?" |
| Summary | Evidence chain | "Why is it bullish?" |
| 1 risk point | Full invalidation | "When should I exit?" |
| Direction | Actionable params | "What size? What stop?" |
| Daily push | Real-time alerts | "I missed the move!" |
| - | Multi-agent debate | "I want to see disagreement" |
| - | Risk ladder | "Size for my account" |
| - | Execution scaffold | "Just do it for me" |

---

## 5. EverInvests Architecture (This Repo)

### 5.1 Current State (Keep As-Is)

```
everinvests/
├── src/pages/           # Astro pages (/, /crypto, /forex, /stocks, /about)
├── src/pages/api/       # API endpoints
├── worker/              # Cloudflare Worker (signal generation cron)
│   └── src/skills/      # 7-skill pipeline
│       ├── fetchMacroData.ts
│       ├── fetchAssetData.ts
│       ├── computeBias.ts
│       ├── qualityChecks.ts
│       ├── generateSummary.ts
│       ├── storeSignal.ts
│       └── notifyTelegram.ts
└── migrations/          # D1 schema
```

### 5.2 What Changes for VIP Integration

**Minimal changes to EverInvests:**
1. Add CTA to free TG messages: "Full analysis at EverInvests VIP"
2. Add CTA to website pages: Subscribe button/link
3. No new skills, no new data sources, no tier logic

**New repo for VIP (separate):**
```
everinvests-vip/
├── signal-worker/       # Premium signal generation
│   └── src/skills/
│       ├── fetchDeribitData.ts      # NEW: IV, skew
│       ├── fetchOnChainData.ts      # NEW: SSR, flows
│       ├── fetchPremiumData.ts      # NEW: Coinbase premium
│       ├── computeRegime.ts         # NEW: 8-12 state engine
│       ├── runAgentDebate.ts        # NEW: multi-agent
│       ├── translateDirective.ts    # NEW: actionable params
│       └── deliverToGroup.ts        # Push to paid TG group
├── bot-worker/          # TG bot for user commands
│   └── src/commands/
│       ├── start.ts
│       ├── status.ts
│       ├── alerts.ts
│       └── execute.ts   # Freqtrade integration
└── migrations/
```

### 5.3 Relationship Between Repos

```
┌─────────────────────────────────────────────────────────────────┐
│                    EVERINVESTS (this repo)                       │
│                                                                  │
│  signal-worker (cron)                                           │
│       │                                                          │
│       ├─→ Website (Astro pages)                                 │
│       │       └─→ CTA: "Subscribe to VIP"                      │
│       │                                                          │
│       └─→ Free TG Channel                                       │
│               └─→ CTA: "Full analysis at EverInvests VIP"          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 │ (users click CTA)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EVERINVESTS VIP (separate repo)                  │
│                                                                  │
│  signal-worker (cron)                                           │
│       │                                                          │
│       └─→ Paid TG Group                                         │
│               └─→ Full regime + directive + alerts              │
│                                                                  │
│  bot-worker (webhook)                                           │
│       │                                                          │
│       └─→ User commands (/status, /alerts, /execute)            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. EverInvests Changes Required

### 6.1 Free TG Channel Message Update

**Current format:**
```
📊 CRYPTO | 2026-01-20 16:00 UTC

Signal: Bullish

BTC and ETH holding above 20-day moving averages...

⚠️ Not financial advice.
🔗 everinvests.com/crypto
```

**Updated format (add CTA):**
```
📊 CRYPTO | 2026-01-20 16:00 UTC

Bias: Bullish

BTC holding above 20D MA with funding normalizing.
Watch: VIX elevated, could reverse on macro shock.

⚠️ Not financial advice.
🔗 everinvests.com/crypto

━━━━━━━━━━━━━━━━━━━━━━━━
Want regime + confidence + directives?
👉 Join EverInvests VIP: t.me/EverInvestsVIPBot (TBD)
```

### 6.2 Website CTA Addition

Add to each signal page (`/crypto`, `/forex`, `/stocks`):

```html
<div class="vip-cta">
  <h3>Want More?</h3>
  <p>Free signals show bias only. EverInvests VIP includes:</p>
  <ul>
    <li>8-12 regime states with confidence scores</li>
    <li>Actionable directives (position, leverage, stops)</li>
    <li>Evidence chain for every signal</li>
    <li>Real-time threshold alerts</li>
    <li>Multi-agent debate visibility</li>
  </ul>
  <a href="https://t.me/EverInvestsVIPBot (TBD)" class="btn">Join EverInvests VIP →</a>
</div>
```

### 6.3 Implementation in notifyTelegram Skill

**File:** `worker/src/skills/notifyTelegram.ts`

```typescript
// Add CTA to message template
const APEX_CTA = `
━━━━━━━━━━━━━━━━━━━━━━━━
Want regime + confidence + directives?
👉 Join EverInvests VIP: t.me/EverInvestsVIPBot (TBD)`;

function formatMessage(signal: CategorySignal): string {
  const emoji = signal.bias === 'Bullish' ? '📈' : signal.bias === 'Bearish' ? '📉' : '📊';

  return `${emoji} ${signal.category.toUpperCase()} | ${signal.date} ${signal.timeSlot} UTC

Bias: ${signal.bias}

${signal.summary}

⚠️ Not financial advice.
🔗 everinvests.com/${signal.category}
${APEX_CTA}`;
}
```

---

## 7. EverInvests VIP Roadmap (Separate Project)

### Phase 0: Foundation (Week 1)
- [ ] Create everinvests-vip repo
- [ ] Set up Paid TG Group
- [ ] MemberPaywall integration for payments
- [ ] Basic bot: /start, /help, /subscribe

### Phase 1: Manual Signals (Week 2-3)
- [ ] Deribit data fetcher (IV, skew)
- [ ] Manual regime tagging (human input)
- [ ] Daily push to paid group (Tier 1 format)
- [ ] First paying subscribers

### Phase 2: Automated Regime Engine (Week 4-5)
- [ ] Rules-based regime classifier v1
- [ ] Confidence scoring
- [ ] Invalidation conditions
- [ ] Evidence chain generation

### Phase 3: Multi-Agent Debate (Week 6-7)
- [ ] Multiple AI agents with different biases
- [ ] Disagreement resolver
- [ ] Human override mechanism

### Phase 4: Real-Time Alerts (Week 8+)
- [ ] Threshold monitoring
- [ ] Alert delivery system
- [ ] Tier 2 features

### Phase 5: Execution Scaffold (Week 10+)
- [ ] Freqtrade adapter
- [ ] Semi-auto mode
- [ ] Audit logging
- [ ] Kill-switch

---

## 8. Success Metrics

### EverInvests (Free Funnel)
| Metric | Target | Tracking |
|--------|--------|----------|
| Free TG channel members | 1,000+ | Telegram |
| Website daily visitors | 500+ | Cloudflare Analytics |
| Click-through to VIP CTA | 5%+ | Link tracking |
| SEO rankings | Top 10 for "crypto signals" | Search console |

### EverInvests VIP (Revenue)
| Metric | Target (90 days) | Tracking |
|--------|------------------|----------|
| Tier 1 subscribers | 50+ | MemberPaywall |
| Tier 2 subscribers | 10+ | MemberPaywall |
| MRR | $5,000+ | MemberPaywall |
| Churn rate | <10%/month | D1 |
| Upgrade rate (T1→T2) | 8%+ | D1 |

---

## 9. Key Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| EverInvests scope | Free only | Site attracts traffic, doesn't monetize |
| VIP scope | Paid TG only | Users check TG, not websites |
| Data separation | Subset for free | Demonstrate value without cannibalization |
| Architecture | Two repos | Clean separation of concerns |
| Regime engine | Rules-first, ML-later | Explainable, debuggable, fast iteration |
| Agent debate | 2 AI + 1 Human | Balance automation with judgment |
| Execution | Semi-auto first | Build trust before full auto |

---

*Document version: 4.0*
*Scope: EverInvests = Free funnel; VIP = Paid premium*
*Last updated: 2026-01-20*
