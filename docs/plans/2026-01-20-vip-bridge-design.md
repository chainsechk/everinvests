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

**Funnel States (Progressive):**

| State | Free Tier CTA Points To | VIP Status |
|-------|------------------------|------------|
| **Pre-Launch** | Waitlist form (collect emails) | Not built yet |
| **Soft Launch** | Edge bot (limited access) | MVP ready, beta testers |
| **Live** | Edge bot (open subscriptions) | Full product |

**Current State:** Pre-Launch (waitlist mode)

**Payment Flow (when VIP is live):**
1. CTA links to edge bot (e.g., `t.me/EverInvestsVIPBot` - TBD)
2. User subscribes via edge bot (powered by MemberPaywall.org)
3. Edge bot generates private invite link to VIP group
4. User joins VIP group

**Note:** VIP group is private - no public link. Edge bot manages subscriptions and generates per-user invite links.

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

### 2.2 EverInvests: Expanded Free Sources

**Current (keep):**
| Signal | Source | Cost | Constraint |
|--------|--------|------|------------|
| Price, MA20, RSI | TwelveData | Free | 800 req/day |
| Funding Rate | Binance API | Free | Unlimited |
| DXY, VIX, 10Y | TwelveData/Alpha Vantage | Free | 25 req/day (AV) |

**To Add (expand free tier value):**
| Signal | Source | Cost | Why Add |
|--------|--------|------|---------|
| Gold (XAU/USD) | TwelveData | Free | Risk-off proxy |
| S&P 500 | TwelveData | Free | Equity context |
| BTC Fear & Greed | Alternative.me | Free | Sentiment |
| BTC Dominance | CoinGecko | Free | Alt season |
| 2Y-10Y Spread | FRED | Free | Recession indicator |
| Fed Funds Rate | FRED | Free | Rate cycle |

**Differentiation (Free vs VIP):**

| Free Gets | VIP Gets |
|-----------|----------|
| Rich data (expanded macro) | + Premium sources (Deribit, SSR) |
| Simple output (Bias only) | + Complex output (Regime, Confidence) |
| Direction | + Actionable directives |
| Summary | + Evidence chain, invalidation |

**Key Principle:** Free tier has rich data but simple analysis. VIP has premium data AND sophisticated analysis.

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

## 6. Pre-VIP Funnel: Waitlist Mode

Before VIP MVP exists, the free tier needs to capture interested users. This section defines the waitlist-first approach.

### 6.1 Waitlist Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRE-VIP STATE (Current)                       │
│                                                                  │
│  Free Site / Free TG Channel                                    │
│       │                                                          │
│       └─→ CTA: "Join VIP Waitlist"                              │
│               │                                                  │
│               ▼                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              WAITLIST OPTIONS                              │  │
│  │                                                            │  │
│  │  Option A: Simple TG Bot                                   │  │
│  │  - t.me/EverInvestsVIPBot with /waitlist command          │  │
│  │  - Stores user_id + timestamp in D1                        │  │
│  │  - Broadcasts launch notification when ready               │  │
│  │                                                            │  │
│  │  Option B: External Form                                   │  │
│  │  - Tally.so / Typeform / Google Form                      │  │
│  │  - Collects email + TG username                           │  │
│  │  - Manual follow-up at launch                             │  │
│  │                                                            │  │
│  │  Option C: Landing Page                                    │  │
│  │  - everinvests.com/vip (static page)                      │  │
│  │  - Email capture with Buttondown/ConvertKit              │  │
│  │  - Auto-sequence at launch                                │  │
│  │                                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                                 │
                    (when VIP MVP ready)
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    POST-VIP STATE (Future)                       │
│                                                                  │
│  Free Site / Free TG Channel                                    │
│       │                                                          │
│       └─→ CTA: "Join EverInvests VIP"                           │
│               │                                                  │
│               ▼                                                  │
│           Edge Bot → Payment → VIP Group                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Recommended: Simple TG Waitlist Bot

**Why TG bot over email forms:**
- Users already on Telegram (our channel)
- One-click join, no form friction
- Direct broadcast channel when VIP launches
- Can later upgrade same bot to handle subscriptions

**Minimal bot commands:**
```
/start     → "Welcome! EverInvests VIP coming soon. Use /waitlist to be first."
/waitlist  → Saves user_id, replies "You're on the list! We'll notify you at launch."
/status    → "VIP launching soon. You're #47 on the waitlist."
```

**Implementation:** Can be added to this repo as a simple worker endpoint, or kept separate. Recommend separate to keep free tier clean.

### 6.3 CTA Configuration

The free tier should use environment-based CTA targeting:

```typescript
// worker/src/config.ts
export const VIP_CTA = {
  // Toggle between waitlist and live modes
  mode: 'waitlist' as 'waitlist' | 'live',

  // Waitlist mode
  waitlist: {
    text: 'Join VIP Waitlist',
    url: 'https://t.me/EverInvestsBot?start=waitlist', // or form URL
  },

  // Live mode (when VIP ready)
  live: {
    text: 'Join EverInvests VIP',
    url: 'https://t.me/EverInvestsVIPBot',
  },
};
```

**Switch process:**
1. Build VIP MVP
2. Test with beta users
3. Change `mode: 'live'` in config
4. Redeploy free tier
5. Notify waitlist users

### 6.4 Waitlist-to-Launch Sequence

```
Day 0:   Deploy free tier with waitlist CTA
         Start collecting waitlist signups

Day 1-N: Build VIP MVP (separate project)
         Waitlist grows organically from free funnel

Day N:   VIP MVP ready
         ├─ Test with 5-10 beta users from waitlist
         ├─ Fix issues
         └─ Soft launch to full waitlist

Day N+1: Switch CTA mode to 'live'
         ├─ Broadcast to waitlist: "VIP is live!"
         └─ Open subscriptions
```

---

## 7. EverInvests Changes Required

### 7.1 Free TG Channel Message Update

**Current format:**
```
📊 CRYPTO | 2026-01-20 16:00 UTC

Signal: Bullish

BTC and ETH holding above 20-day moving averages...

⚠️ Not financial advice.
🔗 everinvests.com/crypto
```

**Updated format (waitlist mode):**
```
📊 CRYPTO | 2026-01-20 16:00 UTC

Bias: Bullish

BTC holding above 20D MA with funding normalizing.
Watch: VIX elevated, could reverse on macro shock.

⚠️ Not financial advice.
🔗 everinvests.com/crypto

━━━━━━━━━━━━━━━━━━━━━━━━
🚀 EverInvests VIP launching soon
Regime analysis • Confidence scores • Actionable directives
👉 Join waitlist: t.me/EverInvestsBot?start=waitlist
```

**Updated format (live mode - when VIP ready):**
```
📊 CRYPTO | 2026-01-20 16:00 UTC

Bias: Bullish

BTC holding above 20D MA with funding normalizing.
Watch: VIX elevated, could reverse on macro shock.

⚠️ Not financial advice.
🔗 everinvests.com/crypto

━━━━━━━━━━━━━━━━━━━━━━━━
Want regime + confidence + directives?
👉 Join EverInvests VIP: t.me/EverInvestsVIPBot
```

### 7.2 Website CTA Addition

Add to each signal page (`/crypto`, `/forex`, `/stocks`):

**Waitlist mode:**
```html
<div class="vip-cta">
  <h3>🚀 EverInvests VIP Launching Soon</h3>
  <p>We're building professional-grade signals with:</p>
  <ul>
    <li>8-12 regime states with confidence scores</li>
    <li>Actionable directives (position, leverage, stops)</li>
    <li>Evidence chain for every signal</li>
    <li>Real-time threshold alerts</li>
  </ul>
  <a href="https://t.me/EverInvestsBot?start=waitlist" class="btn">Join VIP Waitlist →</a>
  <p class="cta-subtext">Be first to know when we launch</p>
</div>
```

**Live mode (when VIP ready):**
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
  <a href="https://t.me/EverInvestsVIPBot" class="btn">Join EverInvests VIP →</a>
</div>
```

### 7.3 Implementation in notifyTelegram Skill

**File:** `worker/src/skills/notifyTelegram.ts`

```typescript
// Environment-based CTA configuration
type CTAMode = 'waitlist' | 'live' | 'none';

const CTA_CONFIG = {
  waitlist: {
    text: `
━━━━━━━━━━━━━━━━━━━━━━━━
🚀 EverInvests VIP launching soon
Regime analysis • Confidence scores • Actionable directives
👉 Join waitlist: t.me/EverInvestsBot?start=waitlist`,
  },
  live: {
    text: `
━━━━━━━━━━━━━━━━━━━━━━━━
Want regime + confidence + directives?
👉 Join EverInvests VIP: t.me/EverInvestsVIPBot`,
  },
  none: {
    text: '',
  },
};

function getVIPCTA(env: Env): string {
  const mode = (env.VIP_CTA_MODE || 'waitlist') as CTAMode;
  return CTA_CONFIG[mode]?.text || '';
}

function formatMessage(signal: CategorySignal, env: Env): string {
  const emoji = signal.bias === 'Bullish' ? '📈' : signal.bias === 'Bearish' ? '📉' : '📊';
  const cta = getVIPCTA(env);

  return `${emoji} ${signal.category.toUpperCase()} | ${signal.date} ${signal.timeSlot} UTC

Bias: ${signal.bias}

${signal.summary}

⚠️ Not financial advice.
🔗 everinvests.com/${signal.category}${cta}`;
}
```

**Worker environment variable:**
```toml
# wrangler.toml
[vars]
VIP_CTA_MODE = "waitlist"  # Options: "waitlist", "live", "none"
```

---

## 8. Expand Free Data Sources

Free tier should be valuable standalone. Current macro indicators are limited (DXY, VIX, 10Y). Expand with more free sources.

### 8.1 Free Source Candidates

| Source | Data | Cost | Notes |
|--------|------|------|-------|
| **FRED API** | US macro (GDP, CPI, rates) | Free | 120 req/min |
| **OpenBB** | Aggregates FRED, Yahoo, etc. | Free | Python SDK or REST |
| **CoinGecko** | Crypto prices, dominance | Free | 30 req/min |
| **Alternative.me** | Crypto Fear & Greed | Free | Public endpoint |
| **Yahoo Finance** | Equities, indices | Free | Unofficial API |

### 8.2 Priority Additions

**Quick wins (use existing TwelveData quota):**
- Gold (XAU/USD) - risk-off proxy
- S&P 500 - equity context
- Oil (WTI) - inflation/energy

**New integrations:**
- BTC Fear & Greed (Alternative.me) - sentiment
- BTC Dominance (CoinGecko) - alt season indicator
- 2Y-10Y Spread (FRED) - recession indicator
- Fed Funds Rate (FRED) - rate cycle

### 8.3 Differentiation Strategy

| Free Tier Gets | VIP Gets (premium sources) |
|----------------|---------------------------|
| Price, MA, RSI | + Deribit IV/Skew |
| Funding rate | + SSR, Coinbase Premium |
| Macro (DXY, VIX, 10Y, FRED) | + Order flow, liquidations |
| Fear & Greed, BTC Dominance | + Vol surface features |
| **Bias only** | **Regime + Confidence + Directives** |

Free tier = rich data, simple output (bias).
VIP tier = premium data + complex analysis (regime, directives).

---

## 9. Success Metrics (Free Tier)

| Metric | Target | Tracking |
|--------|--------|----------|
| Free TG channel members | 1,000+ | Telegram |
| Website daily visitors | 500+ | Cloudflare Analytics |
| Waitlist signups | 200+ | Bot/form |
| Click-through to waitlist | 5%+ | UTM tracking |
| SEO rankings | Top 10 for "crypto signals" | Search console |

---

## 10. Key Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Free tier scope | Expand data, simple output | Valuable standalone, drives waitlist |
| Data strategy | Rich free sources | OpenBB/FRED/CoinGecko - no paid APIs |
| Output differentiation | Bias (free) vs Regime (VIP) | Analysis depth, not data scarcity |
| Pre-VIP funnel | Waitlist mode | Capture interest before VIP MVP |
| CTA config | Environment variable | Switch waitlist→live without code change |
| Architecture | Two repos | Clean separation, independent deployment |

---

*Document version: 6.0*
*Scope: EverInvests free tier improvements + waitlist funnel*
*VIP project: Handled separately*
*Last updated: 2026-01-20*
