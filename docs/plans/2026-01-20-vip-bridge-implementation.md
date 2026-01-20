# EverInvests VIP Bridge Implementation Plan

**Date:** 2026-01-20
**Status:** Ready to Execute
**Version:** 2.0
**Scope:** Changes to FREE tier (site + TG channel) to add VIP CTAs

**This Repo:** Free site + Free TG channel
**Separate Project:** EverInvests VIP (paid group, edge bot via MemberPaywall.org)

---

## Scope Clarification

This plan covers **only** changes to EverInvests to support the VIP funnel:

| In Scope | Out of Scope |
|----------|--------------|
| Add CTA to free TG messages | EverInvests VIP signal generation |
| Add CTA to website pages | Bot-worker for paid group |
| Minor message format updates | Regime engine |
| SEO optimization | User management / subscriptions |

**EverInvests VIP is a separate project** - see design doc Section 7 for its roadmap.

---

## Phase 1: Add VIP CTA to Telegram Messages

**Duration:** 1-2 hours
**Goal:** Every free TG message drives traffic to EverInvests VIP

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

**Updated message format:**
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

**Changes:**
1. Change "Signal:" to "Bias:" (clearer terminology)
2. Add "Watch:" line highlighting key risk
3. Add VIP CTA separator and link

**Implementation:**

```typescript
// Add to notifyTelegram.ts

const APEX_CTA = `
━━━━━━━━━━━━━━━━━━━━━━━━
Want regime + confidence + directives?
👉 Join EverInvests VIP: t.me/EverInvestsVIPBot (TBD)`;

function formatCryptoMessage(signal: CategorySignal): string {
  const emoji = getBiasEmoji(signal.bias);
  const output = JSON.parse(signal.output_json);

  // Extract key risk from risks array
  const keyRisk = output.risks?.[0] || 'Monitor macro conditions';

  return `${emoji} CRYPTO | ${signal.date} ${signal.time_slot} UTC

Bias: ${signal.bias}

${output.summary}
Watch: ${keyRisk}

⚠️ Not financial advice.
🔗 everinvests.com/crypto
${APEX_CTA}`;
}
```

**Acceptance:**
- [ ] Free TG messages include VIP CTA
- [ ] CTA link is clickable
- [ ] Message format is clean and readable

---

## Phase 2: Add VIP CTA to Website

**Duration:** 2-3 hours
**Goal:** Website pages drive traffic to EverInvests VIP

### Task 2.1: Create VIP CTA Component

**File:** `src/components/VIPCTA.astro`

```astro
---
interface Props {
  category?: string;
}

const { category = 'crypto' } = Astro.props;
---

<div class="vip-cta">
  <div class="vip-cta-content">
    <h3>Want More Than Just Bias?</h3>
    <p>Free signals show direction only. EverInvests VIP gives you:</p>
    <ul>
      <li><strong>Regime</strong> — 8-12 market states, not just bullish/bearish</li>
      <li><strong>Confidence</strong> — How much to trust this signal</li>
      <li><strong>Directives</strong> — Position size, leverage, stop-loss</li>
      <li><strong>Evidence</strong> — What data triggered this call</li>
      <li><strong>Invalidation</strong> — When to exit or distrust</li>
      <li><strong>Alerts</strong> — Real-time threshold notifications</li>
    </ul>
    <a href="https://t.me/EverInvestsVIPBot (TBD)" class="vip-btn" target="_blank" rel="noopener">
      Join EverInvests VIP →
    </a>
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

## Phase 4: Analytics Setup

**Duration:** 1 hour
**Goal:** Track funnel conversion from free to paid

### Task 4.1: Add Click Tracking

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

### Task 4.2: Track TG Message Engagement

In the VIP bot (separate project), track `start` parameter to see which source converts best.

**Acceptance:**
- [ ] UTM parameters on all links
- [ ] Can distinguish traffic source in VIP bot

---

## Deployment Checklist

### Pre-Deploy
- [ ] Test CTA component locally
- [ ] Verify TG message format in dev
- [ ] Check all links are correct

### Deploy
```bash
# Deploy website
npm run deploy:prod

# Deploy worker (if TG message changed)
npm run worker:deploy
```

### Post-Deploy
- [ ] Verify website CTA renders
- [ ] Verify TG messages include CTA
- [ ] Click all VIP links to confirm they work

---

## Timeline Summary

| Phase | Duration | Effort |
|-------|----------|--------|
| Phase 1: TG CTA | 1-2 hours | Low |
| Phase 2: Website CTA | 2-3 hours | Low |
| Phase 3: SEO | 1 hour | Low |
| Phase 4: Analytics | 1 hour | Low |
| **Total** | **5-7 hours** | **Low** |

This is a minimal-effort update to EverInvests. The real work is building EverInvests VIP (separate project).

---

## What's NOT in This Plan

These belong in the **EverInvests VIP** project:

- User registration / subscription management
- MemberPaywall integration
- Paid TG group bot
- Regime engine
- Multi-agent debate system
- Deribit / premium data integration
- Real-time alerts
- Execution scaffold

See `2026-01-20-vip-bridge-design.md` Section 7 for VIP roadmap.

---

*Plan version: 2.0*
*Scope: EverInvests free funnel only*
*Last updated: 2026-01-20*
