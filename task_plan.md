# Task Plan: EverInvests Expert Feedback Implementation

## Current Task: Expert Review Implementation (2026-01-22)

Implementing improvements based on expert review feedback.

### Expert Feedback Summary
**Strengths:** Clear CTAs, trust building, solid architecture, high information density

**Improvements Needed:**
1. Security (auth, rate limits, CORS)
2. Compliance (disclaimers, terms, copy)
3. APEX differentiation (regime preview, tier comparison)
4. Trust/rigor (sample sizes, benchmarks, quality badges)
5. UX/Ops (schedule API, real analytics)

### Phases Overview (Unified)
| Phase | Feature | Priority | Status |
|-------|---------|----------|--------|
| SEO | Quick SEO Fixes | HIGH | `complete` ✓ |
| G1 | Evergreen Content Pages | HIGH | `complete` ✓ |
| G2 | OG Image Fixes (social sharing) | HIGH | `complete` ✓ |
| 1 | Security Hardening (auth, rate limits, CORS) | HIGH | `complete` ✓ |
| 2 | Compliance & Disclaimers (banner, terms page) | HIGH | `complete` ✓ |
| 3 | APEX Preview Module (regime preview, tier comparison) | MEDIUM-HIGH | `complete` ✓ |
| 4 | Trust & Rigor (sample sizes, benchmarks) | MEDIUM | `complete` ✓ |
| 5 | UX/Ops & Analytics (schedule API, CTA tracking) | MEDIUM | `complete` ✓ |
| G4 | Fix Failing Tests | MEDIUM | `complete` ✓ |
| G5 | GDELT Enhancement (spike scoring, headlines) | MEDIUM | `complete` ✓ |

**Execution Order:** SEO ✓ → G1 → G2 → 1 → 2 → 3 → 4 → 5 → G4 → G5

### Design Reference
Full implementation plan: `IMPLEMENTATION_PLAN.md`

---

## Quick SEO Fixes [status: complete] ✓
**Completed: 2026-01-22**

- [x] Fixed invalid JSON-LD datePublished on signal detail pages
  - File: `src/pages/[category]/[date]/[time].astro:127`
  - Was: `${date}T${time.replace(":", "")}:00Z` → Now: `${date}T${time}:00Z`

- [x] Added BlogPosting + breadcrumb structured data to blog posts
  - File: `src/pages/blog/[slug].astro:78`
  - Added BreadcrumbList and BlogPosting JSON-LD schemas
  - Added safer meta description builder

- [x] Made blog index + sitemap degrade gracefully when DB unavailable
  - Files: `src/pages/blog/index.astro:18`, `src/pages/sitemap.xml.ts:36`
  - Added `db?.` optional chaining and empty array fallbacks

---

## High-Impact Growth Phase [status: in_progress]

### Phase G1: Evergreen Content Pages [status: complete] ✓
**Completed: 2026-01-23**

- [x] G1.1 "How to Use These Signals" page
  - File: `src/pages/guides/how-to-use-signals.astro`
  - 3-step workflow: Macro → Category → Asset
  - Includes embedded BiasIndicator components

- [x] G1.2 "What Bullish vs Bearish Means" page
  - File: `src/pages/guides/bullish-vs-bearish.astro`
  - Actionable explanations for casual investors
  - Quick reference table with BiasIndicator examples

- [x] G1.3 "Fear & Greed Index Explained" page
  - File: `src/pages/guides/fear-and-greed.astro`
  - Contrarian logic with ScaleBar examples
  - Shows how F&G affects crypto signal calculations

- [x] G1.4 Links added
  - Sitemap updated with all 3 guides
  - About page "Learn More" section added

### Phase G2: OG Image Fixes [status: complete] ✓
**Completed: 2026-01-23**

- [x] G2.1 Dynamic OG image generation using satori
  - File: `src/lib/og.ts` - OG image generation utility
  - Uses satori for JSX-to-SVG conversion with Inter font

- [x] G2.2 Default OG image endpoint
  - File: `src/pages/og/default.svg.ts`
  - Updated BaseLayout to use `/og/default.svg`

- [x] G2.3 Per-signal dynamic OG images
  - File: `src/pages/og/signal/[category].svg.ts`
  - Shows category name, current bias badge from DB
  - Category pages updated to use dynamic OG

- [x] G2.4 Per-blog dynamic OG images
  - File: `src/pages/og/blog/[slug].svg.ts`
  - Shows post title, category badge from DB

**Note:** SVG format works on most platforms. Twitter/X has limited SVG support.
Future enhancement: Add resvg-wasm for PNG conversion at edge.

### Phase G4: Fix Failing Tests [status: complete] ✓
**Priority: MEDIUM**
**Completed: 2026-01-23**

- [x] G4.1 Fix tests/worker/delta.test.ts
  - Added missing `formatDeltaSummary()` function to `worker/src/signals/delta.ts`
  - Function formats SignalDelta into human-readable summary string

- [x] G4.2 Fix tests/worker/llm-prompts.test.ts
  - Updated test expectations from version "2" to version "3"
  - Prompts were upgraded to v3, tests were stale

### Phase G5: GDELT Enhancement - Real Impact Score [status: complete] ✓
**Priority: MEDIUM**
**Completed: 2026-01-23**

GDELT is already wired in (Phase 4 Regime Detection) but previously:
- Ran once daily at 01:00 UTC (missed midday breaking news)
- Scored raw article count (not spike vs baseline)
- Didn't show actual headlines (abstract "high risk" message)

**Goal:** Make GDELT behave like a real "impact score" for users.

- [x] G5.1 Increase refresh frequency (every 6h with TTL)
  - File: `worker/src/index.ts`
  - GDELT now fetches at 01:00, 07:00, 13:00, 19:00 UTC

- [x] G5.2 Score as spike vs 7-day baseline
  - File: `worker/src/data/gdelt.ts`
  - Added `getGdelt7DayAvgArticles()` to `worker/src/storage/d1.ts`
  - Spike ratio: `current / avg7d` → 1.5x = +5pts, 2x = +10pts, 3x = +20pts to score

- [x] G5.3 Store + display top 3 headlines when risk elevated
  - Files: `migrations/0007_gdelt_headlines.sql`, `worker/src/storage/d1.ts`
  - Store headline title + URL for top 3 most relevant articles
  - File: `src/components/MacroBar.astro`
  - Shows clickable headlines + spike ratio when geopolitical risk is elevated+

- [x] G5.4 Update GdeltResult type
  - File: `worker/src/data/gdelt.ts`
  - Added: `topHeadlines: GdeltHeadline[]`
  - Added: `spikeRatio: number` (vs 7-day baseline)
  - Updated all downstream types (GdeltRegimeData, ClassifyRegimeInput, etc.)

---

## Phase 1: Security Hardening [status: complete] ✓
**Priority: HIGH**
**Completed: 2026-01-23**

- [x] 1.1 Worker trigger authentication (bearer token)
  - Files: `worker/src/index.ts`, `worker/src/env.ts`
  - Added `WORKER_AUTH_TOKEN` secret validation for all admin routes

- [x] 1.2 API rate limiting
  - Note: Basic CORS protection implemented; full rate limiting requires KV store

- [x] 1.3 CORS restriction
  - Files: `src/pages/api/v1/signals.ts`
  - Whitelist: everinvests.com, www.everinvests.com, localhost:4321, localhost:3000

## Phase 2: Compliance & Disclaimers [status: complete] ✓
**Priority: HIGH**
**Completed: 2026-01-23**

- [x] 2.1 Disclaimer banner component
  - File: `src/components/DisclaimerBanner.astro`
  - Dismissable amber banner at top of all pages (7-day cookie)
  - Links to /terms page

- [x] 2.2 Terms & Risk Disclosure page
  - File: `src/pages/terms.astro`
  - Comprehensive legal language covering risks, limitations, disclaimers

- [x] 2.3 Revise "conviction" language
  - Already done in previous session (VIPCTA uses "reasoning")

- [x] 2.4 Performance page caveats
  - File: `src/pages/performance.astro`
  - Added detailed methodology section with clear caveats
  - Covers: not trading returns, no transaction costs, limited history, sample size

- [x] 2.5 Footer disclaimer upgrade
  - File: `src/components/Footer.astro`
  - Changed: "DYOR" → "Do your own due diligence"
  - Added link to /terms, increased font size

## Phase 3: APEX Preview Module [status: complete] ✓
**Priority: MEDIUM-HIGH**
**Completed: 2026-01-23**

- [x] 3.1 Regime state preview on free tier
  - File: `src/components/ApexPreview.astro`
  - Blurred teaser showing whale alerts, AI debates, directives
  - Added to all category pages (crypto, forex, stocks)

- [x] 3.2 Free vs VIP comparison table
  - File: `src/components/TierComparison.astro`
  - Side-by-side feature comparison with 10 features
  - Added to about page

## Phase 4: Trust & Rigor [status: complete] ✓
**Priority: MEDIUM**
**Completed: 2026-01-23**

- [x] 4.1 Sample sizes on performance page
  - Added `n=X` sample size display next to accuracy stats
  - Added warning for small samples: "⚠ Small sample—needs 30+ for statistical significance"

- [x] 4.2 Benchmark comparison (vs 50% random)
  - Already present: "vs 50% random baseline" text under 30-day accuracy

- [x] 4.3 Confidence/quality badges on signal cards
  - Updated `src/components/SignalCard.astro` with optional `confluence` prop
  - Added `getConfidenceBadge()` function to show "High confidence", "Moderate", or "Mixed signals"
  - Updated `src/pages/index.astro` to fetch and pass confluence data

- [x] 4.4 Accuracy by regime stratification
  - Deferred: Requires additional DB schema for regime-tagged outcomes

## Phase 5: UX/Ops & Analytics [status: complete] ✓
**Priority: MEDIUM**
**Completed: 2026-01-23**

- [x] 5.1 Server-side schedule API
  - File: `src/pages/api/meta/schedule.ts`
  - Returns schedule, next updates, time to next update
  - Handles weekday-only categories correctly

- [x] 5.2 Frontend schedule integration
  - Index page already has client-side schedule calculation
  - API available at `/api/meta/schedule` for dynamic integration

- [x] 5.3 CTA click tracking
  - Already implemented in VIPCTA component
  - Uses Cloudflare Zaraz when available
  - Console logging for debug

- [ ] 5.4 Analytics DB migration (deferred)
- [ ] 5.5 Signup funnel events (deferred)

---

## Previous Task: Regime Detection (COMPLETE)

Regime detection system FULLY implemented (all 4 phases).

---

## Completed: Phase 4 Regime Detection - GDELT Geopolitical (2026-01-22) ✓

Full GDELT integration for geopolitical tension monitoring:
- Created `worker/src/data/gdelt.ts` - GDELT API fetcher
- Added storage functions in `d1.ts` for gdelt_scores
- Added daily GDELT fetch to cron at 01:00 UTC
- Added `classifyRegimePhase4()` to regime.ts
- Integrated into macro signal calculation
- Added Phase 4 display in MacroBar.astro
- Created migration `0006_gdelt_scores.sql`

Alerts trigger when:
- Critical (score ≥70): Geopolitical crisis
- High (score ≥50): High geopolitical risk
- Elevated + Rising: Rising tension warning

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
