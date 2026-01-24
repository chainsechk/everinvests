# Findings & Decisions

## P0/P1 Bug Analysis (2026-01-23)

### P0.1: RSS/MCP Schema Mismatch
**Files:** `src/pages/rss.xml.ts:64`, `mcp-server/src/index.ts:183`
**Issue:** Queries `signals.summary` and `signals.created_at` but schema only has:
- `generated_at` (not `created_at`)
- No `summary` column - it's in `output_json` as `output_json.summary`

**Fix:** Derive from existing columns:
```sql
-- Instead of: SELECT summary, created_at
SELECT output_json, generated_at FROM signals
-- Then: JSON.parse(output_json).summary
```

### P0.2: Confluence Fallback Logic
**File:** `src/pages/api/v1/signals.ts:187`
**Issue:**
```typescript
const bullish = signals.filter(s => s === "bullish" || s === "confirms").length;
```
"Volume: confirms" means volume confirms the trend direction, not that it's bullish.
If trend is bearish and volume confirms, counting "confirms" as bullish is wrong.

**Fix:** Only count actual directional signals:
```typescript
const bullish = signals.filter(s => s === "bullish").length;
const bearish = signals.filter(s => s === "bearish").length;
// "confirms" and "diverges" are confirmations, not directions
```

### P0.3: Cache Key Redaction
**File:** `worker/src/cache/ttl.ts:36`
**Issue:** Only strips `apikey=`, but FRED uses `api_key=`:
```typescript
const sanitizedUrl = url.replace(/apikey=[^&]+/, "apikey=REDACTED");
```

**Fix:** Add pattern for all API key formats:
```typescript
const sanitizedUrl = url
  .replace(/apikey=[^&]+/gi, "apikey=REDACTED")
  .replace(/api_key=[^&]+/gi, "api_key=REDACTED");
```

### P0.4: Risk Heuristics String Parsing
**File:** `worker/src/signals/bias.ts:441,446`
**Issue:**
```typescript
const highFunding = assetSignals.some(s => parseFloat(s.secondaryInd) > 0.05);
const highRSI = assetSignals.filter(s => parseFloat(s.secondaryInd) > 65).length;
```
But `secondaryInd` can be "F&G:45" or "YC:normal" - parseFloat returns NaN.

**Fix:** Extract numeric part or handle string formats:
```typescript
// For crypto with F&G format
const match = s.secondaryInd.match(/F&G:(\d+)/);
const fearGreed = match ? parseInt(match[1]) : null;

// For stocks with RSI (plain number)
const rsi = /^\d+(\.\d+)?$/.test(s.secondaryInd) ? parseFloat(s.secondaryInd) : null;
```

### P1.1: Track Endpoint Rate Limiting
**File:** `src/pages/api/track.ts`
**Issue:** Unauthenticated POST writes to D1. Could be abused for:
- Spam (fill up analytics_events table)
- Cost blowup (D1 writes aren't free at scale)

**Fix options:**
1. Cloudflare rate limiting rule in dashboard (simplest)
2. In-code rate limiting with CF's Rate Limiting API
3. Payload size cap (already implicit from JSON parsing, but explicit limit safer)

### P1.2: Edge Caching Strategy
**Goal:** Reduce D1 load, improve TTFB for SSR pages.

| Page Type | TTL | Rationale |
|-----------|-----|-----------|
| `/[category]` (latest) | 5 min | Updates 3x/day, fresh data important |
| `/[category]/[date]/[time]` | 1 week | Historical, never changes |
| `/performance` | 1 hour | Accuracy updates daily at 01:00 UTC |
| `/api/v1/signals` | 5 min | Already has Cache-Control |

**Implementation:** Astro middleware or `_headers` file for Cloudflare Pages.

---

## Pre-i18n Issues to Address (2026-01-23)

### Caching Reality Check
**Issue:** `public/_headers` doesn't apply to SSR routes on Cloudflare Pages.
- Production shows `cf-cache-status: DYNAMIC` on `/` and `/crypto`
- `_headers` only works for static assets, not Worker/SSR responses

**Fix options:**
1. Set `Cache-Control` directly in Astro page responses (per-route)
2. Use Cloudflare Cache Rules in dashboard (edge-level)
3. Use Cache API in Astro middleware for SSR pages

### SEO Hardcoding
**Issue:** Hardcoded `https://everinvests.com` in multiple places instead of `SITE_URL`:
- JSON-LD structured data
- Breadcrumb schemas
- Embed widget URLs

**Action:** Audit and centralize all URL generation through `SITE_URL` or `absoluteUrl()`.

### Locale-Hostile Formatting
**Issue:** Hardcoded `en-US` locale throughout:
```typescript
// Scattered in components/pages:
toLocaleDateString("en-US", ...)
toLocaleTimeString("en-US", ...)
```

**Action:** Create centralized formatting functions that accept locale parameter.

### Linking Strategy
**Issue:** Absolute root paths like `href="/crypto"` will break with `/{lang}/crypto` routing.

**Action:** Create `l(path)` localized link builder before i18n implementation.

---

## i18n Implementation (2026-01-24)

### Scope Decision
**Option A: UI-only translation** - Signal summaries stay English (separate project later)

### Platform Layer (Implemented)
Created `src/i18n/index.ts` with:

```typescript
// Core types
export const locales = ["en", "es", "zh", "ar", "pt"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

// Translation functions
export function t(key: string, locale: Locale, params?: Record<string, string | number>): string;
export function useTranslations(locale: Locale): (key: string, params?) => string;

// Routing utilities
export function l(path: string, locale: Locale): string;  // "/crypto" + "es" → "/es/crypto"
export function getLocaleFromUrl(url: URL): Locale;       // Extract locale from pathname

// SEO/RTL support
export function getDirection(locale: Locale): "ltr" | "rtl";
export function getAlternateUrls(pathname: string, baseUrl: string): Array<{ locale, url }>;
```

### SEO Implementation (Complete)
- `<html lang={locale} dir={dir}>` - Dynamic in BaseLayout
- `<link rel="canonical" href={canonicalUrl}>` - Per-page
- `<link rel="alternate" hreflang="...">` - All 5 locales + x-default
- `<meta property="og:locale">` - For social sharing

### Astro i18n Config
```javascript
// astro.config.mjs
i18n: {
  defaultLocale: "en",
  locales: ["en", "es", "zh", "ar", "pt"],
  routing: { prefixDefaultLocale: false },  // /crypto not /en/crypto
  fallback: { es: "en", zh: "en", ar: "en", pt: "en" }
}
```

### Translation File Structure
```
src/i18n/
├── index.ts           # Core module
└── locales/
    ├── en.json        # English (base, ~80 keys)
    ├── es.json        # Spanish
    ├── zh.json        # Chinese Simplified
    ├── ar.json        # Arabic (RTL)
    └── pt.json        # Portuguese
```

### Key Translation Keys
```json
{
  "site.name": "EverInvests",
  "site.description": "Free daily market signals...",
  "nav.home": "Home",
  "nav.crypto": "Crypto",
  "signal.bullish": "Bullish",
  "signal.bearish": "Bearish",
  "home.hero.title": "We ran money.",
  "home.hero.titleHighlight": "Now we share our edge.",
  "footer.copyright": "© {year} EverInvests. All rights reserved."
}
```

### RTL Strategy (For Arabic)
- `getDirection("ar")` returns `"rtl"`
- BaseLayout sets `<html dir={dir}>`
- Tailwind RTL utilities available if needed
- OG images: English-only for now (font complexity)

---

## i18n Research (2026-01-23)

### Codebase Analysis
- **24 pages** need translation (core, category, educational, blog)
- **22 components** have hardcoded strings (~150-200 unique)
- **No existing i18n infrastructure** found

### High-Priority Components for Translation
| Component | Strings | Notes |
|-----------|---------|-------|
| Header.astro | 7 | Navigation labels |
| Footer.astro | 15+ | Links, disclaimers |
| MacroBar.astro | 30+ | Complex, many tooltips |
| SignalCard.astro | 8 | Category labels |
| TelegramCTA.astro | 6+ | Conversion-critical |
| VIPCTA.astro | 12+ | Marketing copy |
| TierComparison.astro | 20+ | Feature descriptions |

### Technical Decisions
| Decision | Rationale |
|----------|-----------|
| astro-i18n | Native Astro 5 integration, SSR-compatible |
| URL routing (/[lang]/) | SEO-friendly, standard practice |
| JSON translation files | Simple, tooling support |
| Generate signals in target language | Better quality than post-translation |

### Recommended File Structure
```
src/
├── i18n/
│   ├── en.json, es.json, zh.json, hi.json, ar.json
│   ├── fr.json, bn.json, pt.json, ru.json, ja.json
│   ├── de.json, ko.json, vi.json, it.json, tr.json, pl.json
├── pages/
│   └── [lang]/
│       ├── index.astro
│       └── ...
└── lib/
    └── i18n.ts
```

### Challenges Identified
1. **RTL support** - Arabic requires CSS direction changes
2. **OG fonts** - CJK, Arabic, Cyrillic need Satori config
3. **LLM signals** - Need multi-language prompt engineering
4. **Legal disclaimers** - May need per-jurisdiction review
5. **Maintenance** - 24 pages × 15 languages = 360 variants

---

## Growth Optimization Research (2026-01-23)

### Current State Analysis

**What's Already Done:**
- 3 evergreen guide pages exist (`/guides/*`)
- Dynamic OG images (SVG format) for categories and blogs
- Disclaimer banner with dismissal
- Terms page with full legal disclosure
- VIPCTA component on all pages
- CTA tracking (client-side to Cloudflare Zaraz)
- Schedule API at `/api/meta/schedule`

**Gaps Identified:**
| Area | Current | Needed |
|------|---------|--------|
| SEO | 3 guides only | Glossary, methodology, risk-on/off pages |
| Internal links | Minimal | Aggressive cross-linking |
| Social sharing | Category OG only | Per-signal OG + share buttons |
| Distribution | None | Embeddable widget |
| CTA tracking | Client-side | Server-side for reliability |
| Speed | Unknown | Need Lighthouse audit |

---

## SEO Strategy

### Programmatic SEO Approach

**Goal:** Reduce "thin page" risk by creating interconnected content.

**Page Types:**
1. **Signal pages** - Daily generated content (ephemeral)
2. **Category pages** - Overview with latest signal (semi-static)
3. **Learn pages** - Evergreen educational content (static, SEO-targeted)
4. **Glossary** - Term definitions (long-tail keywords)

**Internal Linking Map:**
```
Homepage
├── /crypto → /learn/glossary#bias, /guides/fear-and-greed
├── /forex → /learn/risk-on-risk-off, /learn/methodology
├── /stocks → /learn/glossary#rsi, /guides/how-to-use-signals
│
├── /crypto/2026-01-23/0800 (signal detail)
│   └── Share block, methodology link, glossary tooltips
│
├── /learn/glossary
│   └── Links to all category pages, guides
│
├── /learn/methodology
│   └── Links to performance, category pages
│
└── /about
    └── Links to all learn pages
```

### Schema Markup Strategy

| Page Type | Schema | Purpose |
|-----------|--------|---------|
| Glossary | DefinedTermSet | Rich snippets for definitions |
| Guides | HowTo | Step-by-step rich results |
| Signal detail | Article + BreadcrumbList | News-like appearance |
| Category pages | WebPage + BreadcrumbList | Navigation context |

---

## Social Sharing Strategy

### OG Image Requirements

**Current limitation:** SVG OG images have limited support on Twitter/X.

**Options:**
1. **satori + resvg-wasm** - Convert to PNG at edge (added resvg-wasm to deps)
2. **Cloudinary** - External service for transformations
3. **Accept SVG** - Works on most platforms except Twitter

**Decision:** Prioritize PNG conversion for Twitter compatibility.

### Share Block Design

```
┌─────────────────────────────────────┐
│  📊 Share this signal               │
│  ┌─────┐ ┌─────┐ ┌─────────────┐   │
│  │  𝕏  │ │ 🔗  │ │ Reddit      │   │
│  └─────┘ └─────┘ └─────────────┘   │
│  "Crypto: Bullish - BTC above MA20" │
└─────────────────────────────────────┘
```

**Pre-filled share text:**
- Twitter: "🟢 Crypto signal: Bullish | BTC +2.3% | ETH +1.1% | via @EverInvests everinvests.com/crypto"
- Reddit: Link post to signal page with title

---

## Embeddable Widget Strategy

### Widget Architecture

**Option A: iframe**
```html
<iframe src="https://everinvests.com/embed/crypto"
        width="300" height="200" frameborder="0"></iframe>
```
- Pros: Full isolation, no style conflicts
- Cons: Fixed size, no responsive

**Option B: JavaScript snippet**
```html
<div id="everinvests-widget" data-category="crypto"></div>
<script src="https://everinvests.com/embed/widget.js"></script>
```
- Pros: Responsive, customizable
- Cons: Style conflicts possible

**Decision:** Start with iframe for simplicity, add JS version later.

### Widget Content
```
┌─────────────────────────────┐
│ 📈 Today's Signals          │
│                             │
│ 🟢 Crypto: Bullish          │
│ 🟡 Forex: Neutral           │
│ 🔴 Stocks: Bearish          │
│                             │
│ Updated 2h ago              │
│ ─────────────────────────── │
│ Powered by EverInvests →    │
└─────────────────────────────┘
```

---

## Core Web Vitals Baseline

### Key Metrics to Optimize
| Metric | Target | Impact |
|--------|--------|--------|
| LCP (Largest Contentful Paint) | < 2.5s | SEO ranking factor |
| FID (First Input Delay) | < 100ms | User experience |
| CLS (Cumulative Layout Shift) | < 0.1 | Visual stability |
| TTFB (Time to First Byte) | < 800ms | Server response |

### Common Issues to Check
1. **Render-blocking fonts** - Google Fonts without preload
2. **Unoptimized images** - SVG/PNG without compression
3. **Third-party scripts** - Analytics, tracking
4. **CSS not purged** - Unused Tailwind classes

### Astro + Cloudflare Advantages
- Static pre-rendering = fast TTFB
- Edge caching = global low latency
- No hydration by default = small JS

---

## Conversion Funnel Analysis

### Current Funnel
```
Page View → See Signal → See CTA → Click CTA → Open Telegram → Join
   100%        90%         70%       ???        ???         ???
```

**Gap:** No visibility after CTA click (client-side only).

### Tracking Needed
| Event | Current | Needed |
|-------|---------|--------|
| Page view | Cloudflare Analytics | ✓ |
| CTA impression | None | Server-side count |
| CTA click | Client-side Zaraz | Server-side backup |
| Telegram join | None | Bot webhook (if possible) |

### CTA Optimization
- **Remove duplicate CTAs** - One primary per page section
- **Add urgency** - "Next update in X hours"
- **Soft VIP teaser** - Show value without hard sell

---

## Previous Findings (Archived)

### GDELT Integration (2026-01-23)
See archived findings for GDELT top 3 news implementation details.

### Expert Review Implementation (2026-01-22)
Security, compliance, trust improvements all complete.

### Volume-Based Confluence Model (2026-01-21)
Trend + Volume + Strength model deployed successfully.
