# EverInvests VIP Bridge Implementation Plan

**Date:** 2026-01-20
**Status:** Ready to Execute
**Version:** 3.0
**Scope:** Changes to FREE tier (site + TG channel) to add VIP CTAs + expand free data sources

**This Repo:** Free site + Free TG channel
**Separate Project:** EverInvests VIP (paid group, edge bot via MemberPaywall.org)

**Current Funnel State:** Pre-Launch (waitlist mode - VIP not built yet)

---

## Scope Clarification

This plan covers changes to EverInvests free tier:

| In Scope | Out of Scope |
|----------|--------------|
| Add CTA to free TG messages (waitlist mode) | EverInvests VIP signal generation |
| Add CTA to website pages | Bot-worker for paid group |
| Expand free macro data sources | Regime engine |
| Environment-based CTA config | User management / subscriptions |
| SEO optimization | Payment integration |

**Key principle:** Free tier should be valuable on its own with expanded free sources. VIP differentiation comes from premium sources + regime engine + directives, not from limiting free.

**EverInvests VIP is a separate project** - see design doc Section 8 for its roadmap.

---

## Phase 0: Environment-Based CTA Configuration

**Goal:** Support waitlist mode now, switch to live mode when VIP ready

### Task 0.1: Add CTA Configuration

**File:** `worker/wrangler.toml`

```toml
[vars]
VIP_CTA_MODE = "waitlist"  # Options: "waitlist", "live", "none"
```

**File:** `worker/src/config.ts`

```typescript
export type CTAMode = 'waitlist' | 'live' | 'none';

export const CTA_CONFIG = {
  waitlist: {
    telegram: `
━━━━━━━━━━━━━━━━━━━━━━━━
🚀 EverInvests VIP launching soon
Regime analysis • Confidence scores • Directives
👉 Join waitlist: t.me/EverInvestsBot?start=waitlist`,
    website: {
      title: '🚀 EverInvests VIP Launching Soon',
      cta: 'Join VIP Waitlist →',
      url: 'https://t.me/EverInvestsBot?start=waitlist',
    },
  },
  live: {
    telegram: `
━━━━━━━━━━━━━━━━━━━━━━━━
Want regime + confidence + directives?
👉 Join EverInvests VIP: t.me/EverInvestsVIPBot`,
    website: {
      title: 'Want More Than Just Bias?',
      cta: 'Join EverInvests VIP →',
      url: 'https://t.me/EverInvestsVIPBot',
    },
  },
  none: {
    telegram: '',
    website: null,
  },
};

export function getCTAConfig(mode: CTAMode) {
  return CTA_CONFIG[mode] || CTA_CONFIG.waitlist;
}
```

**Acceptance:**
- [ ] CTA mode configurable via environment
- [ ] Switching modes requires only config change + redeploy

---

## Phase 1: Add VIP CTA to Telegram Messages

**Goal:** Every free TG message drives traffic to VIP waitlist/subscription

### Task 1.1: Update notifyTelegram Skill

**File:** `worker/src/skills/notifyTelegram.ts`

**Current message format:**
```
📊 CRYPTO | 2026-01-20 16:00 UTC

Signal: Bullish

BTC and ETH holding above 20-day moving averages...

⚠️ Not financial advice.
🔗 everinvests.com/crypto
```

**Updated message format (waitlist mode):**
```
📊 CRYPTO | 2026-01-20 16:00 UTC

Bias: Bullish

BTC holding above 20D MA with funding normalizing.
Watch: VIX elevated, could reverse on macro shock.

⚠️ Not financial advice.
🔗 everinvests.com/crypto

━━━━━━━━━━━━━━━━━━━━━━━━
🚀 EverInvests VIP launching soon
Regime analysis • Confidence scores • Directives
👉 Join waitlist: t.me/EverInvestsBot?start=waitlist
```

**Changes:**
1. Change "Signal:" to "Bias:" (clearer terminology)
2. Add "Watch:" line highlighting key risk
3. Add configurable VIP CTA based on environment

**Implementation:**

```typescript
// Update notifyTelegram.ts

import { getCTAConfig, CTAMode } from '../config';

function formatCryptoMessage(signal: CategorySignal, env: Env): string {
  const emoji = getBiasEmoji(signal.bias);
  const output = JSON.parse(signal.output_json);
  const ctaMode = (env.VIP_CTA_MODE || 'waitlist') as CTAMode;
  const cta = getCTAConfig(ctaMode).telegram;

  // Extract key risk from risks array
  const keyRisk = output.risks?.[0] || 'Monitor macro conditions';

  return `${emoji} CRYPTO | ${signal.date} ${signal.time_slot} UTC

Bias: ${signal.bias}

${output.summary}
Watch: ${keyRisk}

⚠️ Not financial advice.
🔗 everinvests.com/crypto${cta}`;
}
```

**Acceptance:**
- [ ] Free TG messages include VIP CTA
- [ ] CTA reflects current mode (waitlist/live)
- [ ] Message format is clean and readable

---

## Phase 2: Add VIP CTA to Website

**Goal:** Website pages drive traffic to VIP waitlist/subscription

### Task 2.1: Create VIP CTA Component

**File:** `src/components/VIPCTA.astro`

```astro
---
interface Props {
  category?: string;
  mode?: 'waitlist' | 'live';
}

const { category = 'crypto', mode = 'waitlist' } = Astro.props;

const config = {
  waitlist: {
    title: '🚀 EverInvests VIP Launching Soon',
    subtitle: "We're building professional-grade signals with:",
    cta: 'Join VIP Waitlist →',
    url: 'https://t.me/EverInvestsBot?start=waitlist',
    subtext: 'Be first to know when we launch',
  },
  live: {
    title: 'Want More Than Just Bias?',
    subtitle: 'Free signals show direction only. EverInvests VIP gives you:',
    cta: 'Join EverInvests VIP →',
    url: 'https://t.me/EverInvestsVIPBot',
    subtext: null,
  },
};

const c = config[mode];
---

<div class="vip-cta">
  <div class="vip-cta-content">
    <h3>{c.title}</h3>
    <p>{c.subtitle}</p>
    <ul>
      <li><strong>Regime</strong> — 8-12 market states, not just bullish/bearish</li>
      <li><strong>Confidence</strong> — How much to trust this signal</li>
      <li><strong>Directives</strong> — Position size, leverage, stop-loss</li>
      <li><strong>Evidence</strong> — What data triggered this call</li>
      <li><strong>Invalidation</strong> — When to exit or distrust</li>
      <li><strong>Alerts</strong> — Real-time threshold notifications</li>
    </ul>
    <a href={c.url} class="vip-btn" target="_blank" rel="noopener">
      {c.cta}
    </a>
    {c.subtext && <p class="cta-subtext">{c.subtext}</p>}
  </div>
</div>

<style>
  .vip-cta {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border: 1px solid #0f3460;
    border-radius: 12px;
    padding: 1.5rem;
    margin: 2rem 0;
  }

  .vip-cta h3 {
    color: #e94560;
    margin: 0 0 0.75rem 0;
    font-size: 1.25rem;
  }

  .vip-cta p {
    color: #a0a0a0;
    margin: 0 0 1rem 0;
  }

  .vip-cta ul {
    color: #d0d0d0;
    margin: 0 0 1.5rem 0;
    padding-left: 1.25rem;
  }

  .vip-cta li {
    margin-bottom: 0.5rem;
  }

  .vip-cta strong {
    color: #f0f0f0;
  }

  .vip-btn {
    display: inline-block;
    background: #e94560;
    color: white;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
    transition: background 0.2s;
  }

  .vip-btn:hover {
    background: #ff6b6b;
  }
</style>
```

### Task 2.2: Add CTA to Signal Pages

**Files to update:**
- `src/pages/crypto.astro`
- `src/pages/forex.astro`
- `src/pages/stocks.astro`

**Add after signal display:**

```astro
---
import VIPCTA from '../components/VIPCTA.astro';
---

<!-- Existing signal content -->
<div class="signal-content">
  <!-- ... -->
</div>

<!-- Add VIP CTA -->
<VIPCTA category="crypto" />
```

### Task 2.3: Add CTA to Homepage

**File:** `src/pages/index.astro`

Add CTA in the "Why Subscribe" or footer section:

```astro
<section class="vip-promo">
  <h2>Ready for Professional-Grade Signals?</h2>
  <p>
    EverInvests shows you the direction.
    EverInvests VIP tells you exactly what to do.
  </p>
  <a href="https://t.me/EverInvestsVIPBot (TBD)" class="vip-btn-large">
    Join EverInvests VIP →
  </a>
</section>
```

**Acceptance:**
- [ ] CTA component renders correctly
- [ ] CTA appears on all signal pages
- [ ] CTA appears on homepage
- [ ] Links open in new tab
- [ ] Styling matches site theme

---

## Phase 3: SEO and Meta Updates

**Duration:** 1 hour
**Goal:** Improve discoverability and set expectations

### Task 3.1: Update Meta Descriptions

**Files:** All page files in `src/pages/`

Add/update meta tags to clarify free vs premium:

```astro
---
// crypto.astro
const title = "Free Crypto Signals | BTC & ETH Daily Bias | EverInvests";
const description = "Free daily crypto signals for BTC and ETH. See market bias and key risks. Upgrade to EverInvests VIP for regime analysis, directives, and real-time alerts.";
---

<head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
</head>
```

### Task 3.2: Add Structured Data

**File:** `src/components/Head.astro` or individual pages

```astro
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "EverInvests",
  "description": "Free daily market signals for Crypto, Forex, and Stocks",
  "url": "https://everinvests.com",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://everinvests.com/search?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}
</script>
```

**Acceptance:**
- [ ] Meta descriptions updated on all pages
- [ ] OG tags set correctly
- [ ] Structured data validates

---

## Phase 4: Expand Free Data Sources

**Goal:** Enrich free tier with more free macro/market data (not paid sources)

### Rationale

Current free tier has limited macro indicators:
- DXY (Dollar Index)
- VIX (Volatility Index)
- US 10Y Yield

Free tier should be valuable standalone. VIP differentiation = premium sources + regime engine + directives, NOT artificially limiting free.

### Task 4.1: Research Free Data Sources

**Candidates to evaluate:**

| Source | Data Available | Cost | Rate Limits |
|--------|---------------|------|-------------|
| **OpenBB** | Aggregator (FRED, Yahoo, etc.) | Free | Varies |
| **FRED API** | US macro (GDP, CPI, employment) | Free | 120 req/min |
| **Yahoo Finance** | Equities, indices, ETFs | Free | Unofficial |
| **CoinGecko** | Crypto prices, market cap | Free | 30 req/min |
| **Fear & Greed Index** | Crypto sentiment | Free | Public endpoint |
| **Alternative.me** | Crypto F&G | Free | Public |
| **Quandl/Nasdaq** | Various datasets | Free tier | Limited |

**Research tasks:**
- [ ] Test OpenBB Platform API for macro aggregation
- [ ] Evaluate FRED API for economic indicators
- [ ] Check CoinGecko for crypto market data
- [ ] Find free commodity data (gold, oil)
- [ ] Assess reliability and rate limits

### Task 4.2: Prioritized Free Source Additions

**Phase 4a - Quick Wins (free, reliable):**

| Indicator | Source | Why Add |
|-----------|--------|---------|
| BTC Fear & Greed | Alternative.me | Sentiment context |
| Gold price | TwelveData (existing) | Risk-off proxy |
| S&P 500 | TwelveData (existing) | Equity context |
| BTC Dominance | CoinGecko | Alt season indicator |

**Phase 4b - Macro Expansion (FRED):**

| Indicator | FRED Series | Why Add |
|-----------|-------------|---------|
| Fed Funds Rate | FEDFUNDS | Rate cycle |
| Initial Claims | ICSA | Labor market |
| CPI YoY | CPIAUCSL | Inflation |
| 2Y-10Y Spread | T10Y2Y | Recession indicator |

**Phase 4c - OpenBB Integration (if viable):**

OpenBB Platform can aggregate multiple sources. Evaluate:
- Installation complexity (Python SDK vs REST)
- Worker compatibility (may need external service)
- Data freshness and reliability

### Task 4.3: Implementation Approach

**Option A: Direct API calls (recommended for Workers)**
```typescript
// worker/src/skills/fetchMacroData.ts - expand existing

async function fetchExpandedMacro(env: Env): Promise<MacroData> {
  const [
    existing,      // DXY, VIX, 10Y (current)
    fearGreed,     // Alternative.me
    btcDominance,  // CoinGecko
    gold,          // TwelveData
  ] = await Promise.all([
    fetchCurrentMacro(env),
    fetchFearGreed(),
    fetchBTCDominance(),
    fetchGoldPrice(env),
  ]);

  return { ...existing, fearGreed, btcDominance, gold };
}
```

**Option B: OpenBB as external service**
```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│   Worker    │────▶│  OpenBB Service │────▶│  FRED, etc  │
│  (cron)     │◀────│  (self-hosted)  │◀────│             │
└─────────────┘     └─────────────────┘     └─────────────┘
```

Adds complexity but centralizes data aggregation.

### Task 4.4: Update Signal Logic for New Data

After adding sources, update `computeBias.ts` to incorporate:
- Fear & Greed as sentiment overlay
- Gold as risk-off confirmation
- BTC Dominance for crypto context

**Acceptance:**
- [ ] At least 3 new free data sources integrated
- [ ] No paid API dependencies
- [ ] Signal quality improved with richer context
- [ ] Rate limits respected

---

## Phase 5: Analytics Setup

**Goal:** Track funnel conversion from free to paid

### Task 5.1: Add Click Tracking

**Option A: Simple UTM tracking**

Update all VIP links to include UTM parameters:

```
https://t.me/EverInvestsVIPBot (TBD)?start=everinvests_crypto
https://t.me/EverInvestsVIPBot (TBD)?start=everinvests_forex
https://t.me/EverInvestsVIPBot (TBD)?start=everinvests_stocks
https://t.me/EverInvestsVIPBot (TBD)?start=everinvests_homepage
https://t.me/EverInvestsVIPBot (TBD)?start=everinvests_telegram
```

**Option B: Cloudflare Analytics event**

```typescript
// In VIPCTA.astro
<script>
  document.querySelector('.vip-btn')?.addEventListener('click', () => {
    // If using Cloudflare Web Analytics with custom events
    if (window.zaraz) {
      zaraz.track('vip_cta_click', { source: 'website' });
    }
  });
</script>
```

### Task 5.2: Track TG Message Engagement

Waitlist bot tracks `start` parameter to see which source converts best.

**Acceptance:**
- [ ] UTM parameters on all links
- [ ] Can distinguish traffic source (website vs TG channel)

---

## Deployment Checklist

### Pre-Deploy
- [ ] Test CTA component locally
- [ ] Verify TG message format in dev
- [ ] Check all links are correct
- [ ] Verify new data sources working

### Deploy
```bash
# Deploy website
npm run deploy:prod

# Deploy worker (if TG message or data sources changed)
npm run worker:deploy
```

### Post-Deploy
- [ ] Verify website CTA renders
- [ ] Verify TG messages include CTA
- [ ] Verify new macro data appearing in signals
- [ ] Click all waitlist links to confirm they work

---

## Timeline Summary

| Phase | Effort | Priority |
|-------|--------|----------|
| Phase 0: CTA Config | Low | High (foundation) |
| Phase 1: TG CTA | Low | High |
| Phase 2: Website CTA | Low | High |
| Phase 3: SEO | Low | Medium |
| Phase 4: Expand Free Sources | Medium | High (value) |
| Phase 5: Analytics | Low | Medium |

**Execution order:** 0 → 1 → 2 → 4 → 3 → 5

Phase 4 (expand free sources) is high priority - makes free tier valuable standalone.

---

*Plan version: 3.0*
*Scope: EverInvests free tier improvements + VIP waitlist funnel*
*VIP project handled separately*
*Last updated: 2026-01-20*
