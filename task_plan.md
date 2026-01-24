# Task Plan: EverInvests Growth Optimization

## Current Task: P0/P1 Bug Fixes (2026-01-23)

**Goal:** Fix critical bugs and add protective measures for production stability.

### P0 Fixes (Critical)
| Task | Description | Status |
|------|-------------|--------|
| P0.1 | RSS/MCP schema mismatch: `signals.summary`/`signals.created_at` don't exist | `complete` |
| P0.2 | Confluence fallback counts "confirms" as bullish (conceptually wrong) | `complete` |
| P0.3 | Cache key redaction misses `api_key=` (FRED API) | `complete` |
| P0.4 | Risk heuristics parseFloat on "F&G:xx" / "YC:..." strings | `complete` |

### P1 Fixes (Important)
| Task | Description | Status |
|------|-------------|--------|
| P1.1 | `/api/track` unauthenticated D1 writes - add rate limiting | `complete` |
| P1.2 | Edge caching for SSR pages (short TTL for latest, long for archived) | `complete` |

---

## Current Task: i18n Implementation (IN PROGRESS)

**Goal:** Add internationalization support starting with 5 core languages.

**Status:** Infrastructure complete, page migration in progress

### Scope Decision
**UI-only translation** (signal summaries stay English for now - separate project)

### Pre-i18n Fixes (Complete)
| Issue | Description | Status |
|-------|-------------|--------|
| FIX-1 | SSR caching via middleware (not `_headers`) | `complete` |
| FIX-2 | Centralized `absoluteUrl()` for site URLs | `complete` |
| FIX-3 | Locale-aware formatting in `src/lib/i18n.ts` | `complete` |
| FIX-4 | `l(path, locale)` link builder | `complete` |

### Platform Layer (Complete)
| Utility | Purpose | Status |
|---------|---------|--------|
| `getLocaleFromUrl()` | Get current locale from URL | `complete` |
| `t(key, locale, vars)` | Translation lookup with interpolation | `complete` |
| `useTranslations(locale)` | Bound translation function for components | `complete` |
| `l(path, locale)` | Localized link builder | `complete` |
| `formatDate(date, locale)` | Locale-aware date formatting | `complete` |
| `formatNumber(num, locale)` | Locale-aware number formatting | `complete` |
| `formatRelativeTime(date, locale)` | Relative time ("2 hours ago") | `complete` |
| `getDirection(locale)` | RTL detection for Arabic | `complete` |
| `getAlternateUrls()` | Generate hreflang URLs | `complete` |

### Implementation Phases
| Phase | Description | Status |
|-------|-------------|--------|
| i18n-0 | Pre-i18n fixes (FIX-1 through FIX-4) | `complete` |
| i18n-1 | Platform layer: src/i18n/index.ts | `complete` |
| i18n-2 | Astro i18n config + BaseLayout (lang/dir/hreflang) | `complete` |
| i18n-3 | Homepage + Header + Footer migration | `complete` |
| i18n-4 | Category pages migration (crypto, forex, stocks) | `complete` |
| i18n-5 | Signal detail pages + components | `complete` |
| i18n-6 | Learn/educational pages | `complete` |
| i18n-7 | Language switcher component | `pending` |
| i18n-8 | Localized page routes ([locale]/...) | `pending` |
| i18n-9 | Additional languages (expand from 5 to 15) | `pending` |
| i18n-10 | RTL testing + CJK/Cyrillic OG fonts | `pending` |

### Current Languages (5 - Phase 1)
| Priority | Language | Code | Script | Status |
|----------|----------|------|--------|--------|
| 1 | English | en | Latin | Base (default) |
| 2 | Spanish | es | Latin | Translation complete |
| 3 | Chinese | zh | Simplified Han | Translation complete |
| 4 | Arabic | ar | Arabic (RTL) | Translation complete |
| 5 | Portuguese | pt | Latin | Translation complete |

### Files Created/Modified (2026-01-24)
- `src/i18n/index.ts` - Translation module (t, l, useTranslations, etc.)
- `src/i18n/locales/en.json` - English translations (~80 keys)
- `src/i18n/locales/es.json` - Spanish translations
- `src/i18n/locales/zh.json` - Chinese translations
- `src/i18n/locales/ar.json` - Arabic translations
- `src/i18n/locales/pt.json` - Portuguese translations
- `src/lib/i18n.ts` - Updated to re-export from i18n module
- `src/layouts/BaseLayout.astro` - Dynamic lang/dir, hreflang tags
- `src/components/Header.astro` - Localized nav links
- `src/components/Footer.astro` - Localized links + copyright
- `src/pages/index.astro` - Homepage using t() function
- `astro.config.mjs` - i18n routing configuration

### Commit
`32c7ad0` - feat: i18n infrastructure with 5-locale support (deployed to prod)

---

## Current Task: Tighten Growth Loop (2026-01-23)

### New Phase: Analytics & OG Enhancement
| Task | Description | Status |
|------|-------------|--------|
| T1 | Verify analytics events are flowing | `complete` |
| T2 | Track header/footer Telegram clicks | `complete` |
| T3 | Track widget_view with document.referrer | `complete` |
| T4 | Add 90-day retention cleanup to worker cron | `complete` |
| T5 | Convert OG images SVG → PNG for Twitter/Facebook | `complete` |

---

## Previous Task: Growth Optimization for User Acquisition (2026-01-23)

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
| G6 | Trust/Compliance: Bigger Disclaimer + Methodology + Accuracy Display | MEDIUM | `complete` |

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

## Phase G6: Trust/Compliance Enhancement [status: complete]
**Priority: MEDIUM (reduces bounce, increases shares)**

- [x] G6.1 Bigger disclaimer banner
  - DisclaimerBanner at top with 7-day dismissal
  - Footer has "Not financial advice" + link to /terms
  - Sticky mobile footer not needed (would harm UX)

- [x] G6.2 Methodology page enhancement
  - /learn/methodology has full 3-indicator model explanation
  - Data sources listed (CoinGecko, Binance, TwelveData, Alpha Vantage)
  - Limitations section (timing, magnitude, black swans, past performance)
  - Update schedule table

- [x] G6.3 Accuracy display with confidence
  - Performance page shows "(n=X)" on all accuracy figures
  - Statistical significance warning for samples < 30
  - Benchmark comparison vs 50% random baseline
  - Year-by-year breakdown with sample sizes

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
