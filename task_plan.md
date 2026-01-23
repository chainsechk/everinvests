# Task Plan: EverInvests Growth Optimization

## Current Task: Growth Optimization for User Acquisition (2026-01-23)

**Goal:** Attract more users with $0 budget by optimizing for:
1. Google discovery (SEO)
2. Social sharing
3. Conversion into Telegram
4. Speed/Trust

### Phases Overview
| Phase | Feature | Priority | Status |
|-------|---------|----------|--------|
| G1 | Programmatic SEO: Learn Pages + Internal Linking | HIGH | `complete` |
| G2 | Shareability: Share Block + Per-Signal OG Images | HIGH | `complete` |
| G3 | Distribution: Embeddable Widget | MEDIUM-HIGH | `complete` |
| G4 | Conversion: Next Update Teaser + VIP Value + CTA Tracking | HIGH | `complete` |
| G5 | Core Web Vitals: Eliminate Render-Blocking Resources | HIGH | `complete` |
| G6 | Trust/Compliance: Bigger Disclaimer + Methodology + Accuracy Display | MEDIUM | `pending` |

**Execution Order:** G5 (speed baseline) → G1 → G2 → G4 → G3 → G6

---

## Phase G5: Core Web Vitals [status: pending]
**Priority: HIGH (impacts SEO ranking + retention)**

**Goal:** Eliminate render-blocking fonts/JS, keep pages static/cached.

- [ ] G5.1 Audit current render-blocking resources
  - Run Lighthouse/PageSpeed Insights
  - Identify blocking fonts, CSS, JS

- [ ] G5.2 Optimize font loading
  - Use `font-display: swap` for web fonts
  - Consider self-hosting Inter if using Google Fonts
  - Preload critical fonts

- [ ] G5.3 Defer non-critical JS
  - Add `async`/`defer` to non-critical scripts
  - Move analytics/tracking to after load

- [ ] G5.4 CSS optimization
  - Inline critical CSS if needed
  - Ensure Tailwind purging is working

- [ ] G5.5 Caching headers
  - Verify static assets have long cache
  - Set appropriate cache for API responses

---

## Phase G1: Programmatic SEO [status: pending]
**Priority: HIGH (long-tail search traffic)**

**Existing:** `/guides/how-to-use-signals`, `/guides/bullish-vs-bearish`, `/guides/fear-and-greed`

**New Pages Needed:**
- [ ] G1.1 Glossary page (`/learn/glossary`)
  - Terms: Signal, Bias, Macro context, Fear & Greed, RSI, Confluence, etc.
  - Each term links to relevant signal/guide pages

- [ ] G1.2 "Risk-On vs Risk-Off Explained" (`/learn/risk-on-risk-off`)
  - What drives regime changes
  - How macro context affects signals
  - Link to MacroBar explanation

- [ ] G1.3 "How We Calculate Signals" (`/learn/methodology`)
  - 3-indicator confluence model
  - Data sources
  - Transparency = trust

- [ ] G1.4 Aggressive internal linking
  - From category pages → learn pages (contextual)
  - From asset tables → glossary terms
  - From signal detail pages → methodology
  - From MacroBar → risk-on/risk-off guide

- [ ] G1.5 Schema markup for learn pages
  - FAQPage, HowTo, or DefinedTerm schemas
  - Breadcrumbs on all pages

---

## Phase G2: Shareability Loop [status: pending]
**Priority: HIGH (social traffic + backlinks)**

- [ ] G2.1 "Share this signal" block on signal detail pages
  - File: `src/pages/[category]/[date]/[time].astro`
  - Buttons: X/Twitter, Reddit, Copy Link
  - Pre-filled share text with signal summary

- [ ] G2.2 Per-signal OG images (not just per-category)
  - File: `src/pages/og/signal/[category]/[date]/[time].svg.ts`
  - Show: Category + Date + Bias + Asset summary
  - Consider PNG conversion for Twitter compatibility

- [ ] G2.3 Share preview testing
  - Test on Twitter Card Validator
  - Test on Facebook Debugger
  - Test on LinkedIn Post Inspector

---

## Phase G4: Conversion Optimization [status: pending]
**Priority: HIGH (Telegram funnel)**

- [ ] G4.1 "Next Update" visibility on category pages
  - Show countdown: "Next signal in 4h 23m"
  - Creates urgency and return visits

- [ ] G4.2 "What VIP adds" teaser
  - On category pages, after free signal
  - Brief: "VIP members get: whale alerts, AI debate, action directives"
  - Soft sell, not hard upsell

- [ ] G4.3 Single primary CTA
  - Audit: Remove duplicate CTAs
  - One clear "Join Telegram" per page flow

- [ ] G4.4 CTA click tracking (server-side)
  - Track: CTA impressions, clicks
  - Track: Telegram join events (if possible via bot)
  - Store in D1 for funnel analysis

---

## Phase G3: Embeddable Widget [status: pending]
**Priority: MEDIUM-HIGH (backlinks + referrals)**

- [ ] G3.1 Design widget endpoint
  - `/embed/signals.js` - JavaScript snippet
  - Shows today's signals in iframe/shadow DOM

- [ ] G3.2 Widget customization
  - Theme: light/dark
  - Categories: crypto/forex/stocks/all
  - Size: compact/full

- [ ] G3.3 Widget landing page
  - `/embed` - Instructions for webmasters
  - Copy-paste snippet
  - Preview

- [ ] G3.4 Attribution link
  - "Powered by EverInvests" links back to site
  - UTM tracking for referral source

---

## Phase G6: Trust/Compliance Enhancement [status: pending]
**Priority: MEDIUM (reduces bounce, increases shares)**

- [ ] G6.1 Bigger disclaimer banner
  - Already exists but ensure visibility
  - Consider sticky footer on mobile

- [ ] G6.2 Methodology page enhancement
  - Sample sizes for accuracy stats
  - Time period coverage
  - Limitations and caveats

- [ ] G6.3 Accuracy display with confidence
  - Show "62% accuracy (n=47, 30 days)"
  - Warning for small samples
  - Benchmark vs random baseline

---

## Key Constraints Reminder
| Source | Limit | Current Usage |
|--------|-------|---------------|
| TwelveData | 800 req/day, 8/min | ~6 calls/run |
| Alpha Vantage | 25 req/day | ~3 calls/run |
| CoinGecko | Soft limit | ~2 calls/run |

---

## Previous Implementation (Complete)
All previous phases from expert review are complete:
- Quick SEO fixes ✓
- Evergreen content pages ✓
- OG image generation ✓
- Security hardening ✓
- Compliance & disclaimers ✓
- APEX preview module ✓
- Trust & rigor ✓
- UX/Ops & analytics ✓
- Test fixes ✓
- GDELT enhancement ✓
