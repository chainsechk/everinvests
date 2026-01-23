# Findings & Decisions

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
