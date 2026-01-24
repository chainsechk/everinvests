# Progress Log

## Session: 2026-01-23 (P0/P1 Bug Fixes)

### Task: P0/P1 Bug Fixes
- **Status:** complete
- **Started:** 2026-01-23

#### Actions Taken
- **P0.1:** Fixed RSS/MCP schema mismatch - changed queries to use `output_json` and `generated_at` instead of non-existent `summary` and `created_at` columns
- **P0.2:** Fixed confluence fallback logic - "confirms" no longer counted as "bullish"; only actual directional signals counted
- **P0.3:** Fixed cache key redaction - added patterns for `api_key=`, `key=`, `token=` in addition to `apikey=`
- **P0.4:** Fixed risk heuristics parsing - properly handles "F&G:xx" and plain numeric formats for secondaryInd
- **P1.1:** Added rate limiting to /api/track - 30 req/min per IP using CF Cache API + 2KB payload limit
- **P1.2:** Added edge caching via `public/_headers` - short TTL for latest, long TTL for historical

#### Files Modified
- `src/pages/rss.xml.ts` - Schema fix
- `mcp-server/src/index.ts` - Schema fix
- `src/pages/api/v1/signals.ts` - Confluence logic fix
- `worker/src/cache/ttl.ts` - Cache key redaction
- `worker/src/signals/bias.ts` - Risk heuristics parsing
- `src/pages/api/track.ts` - Rate limiting + payload cap
- `public/_headers` - Edge caching rules (created)

#### Test Results
- All 87 tests pass

---

## Session: 2026-01-24 (i18n Language Switcher)

### Task: Language Switcher Component
- **Status:** complete
- **Started:** 2026-01-24

#### Actions Taken
- Created `src/components/LanguageSwitcher.astro` dropdown component
  - Globe icon with current locale name
  - Dropdown with all 5 locales (en, es, zh, ar, pt)
  - Navigates to same page in selected locale
  - Tracks language_change events to analytics
  - RTL support for Arabic
  - Compact mode for mobile (hides text)
- Added LanguageSwitcher to Header.astro
  - Desktop: Next to ThemeToggle
  - Mobile: In header toolbar with compact mode
- Added translation key `nav.selectLanguage` to all 5 locales

#### Files Modified
- `src/components/LanguageSwitcher.astro` - New component
- `src/components/Header.astro` - Import and render switcher
- `src/i18n/locales/*.json` (all 5) - Added selectLanguage key

#### Build Status
- Build successful

---

## Session: 2026-01-24 (i18n Learn Pages)

### Task: Learn & Guide Pages i18n Migration
- **Status:** complete
- **Started:** 2026-01-24

#### Actions Taken
- Added ~15 new translation keys for learn pages to all 5 locale files:
  - Learn page title, subtitle, SEO description
  - Section headers: methodology, glossary, guides
  - Jump to term, see in action, related guides
  - Bias example text (likely to rise/fall/no direction)
- Updated learn pages with i18n support:
  - `src/pages/learn/index.astro` - Main learn hub
  - `src/pages/learn/glossary.astro` - Trading terms
  - `src/pages/learn/methodology.astro` - Signal calculation
- Updated guide pages with i18n support:
  - `src/pages/guides/bullish-vs-bearish.astro`
  - `src/pages/guides/fear-and-greed.astro`
  - `src/pages/guides/how-to-use-signals.astro`
- UI-only translation approach: UI strings translated, educational content kept in English

#### Files Modified
- `src/i18n/locales/*.json` (all 5 locales) - Added learn page keys
- `src/pages/learn/index.astro` - i18n migration
- `src/pages/learn/glossary.astro` - i18n migration
- `src/pages/learn/methodology.astro` - i18n migration
- `src/pages/guides/bullish-vs-bearish.astro` - i18n migration
- `src/pages/guides/fear-and-greed.astro` - i18n migration
- `src/pages/guides/how-to-use-signals.astro` - i18n migration

#### Build Status
- Build successful

---

## Session: 2026-01-24 (i18n Signal Detail Pages)

### Task: Signal Detail Pages i18n Migration
- **Status:** complete
- **Started:** 2026-01-24

#### Actions Taken
- Added ~20 new translation keys for signal detail pages to all 5 locale files:
  - Signal page title, recent signals, back to category
  - How we calculate signals, what does X mean
  - SignalDetail component: macro, bullish triggers, risk factors
  - Quality flag messages (macro fallback, stale, missing assets, outliers)
  - HistoryMini: recent signals, no history message
- Updated `src/pages/[category]/[date]/[time].astro` with full i18n support
- Updated `src/components/SignalDetail.astro` with locale prop and translations
- Updated `src/components/HistoryMini.astro` with locale prop and translations

#### Files Modified
- `src/i18n/locales/*.json` (all 5 locales) - Added signal detail keys
- `src/pages/[category]/[date]/[time].astro` - Full i18n migration
- `src/components/SignalDetail.astro` - i18n migration
- `src/components/HistoryMini.astro` - i18n migration

#### Build Status
- Build successful

---

## Session: 2026-01-24 (i18n Category Pages)

### Task: Category Pages i18n Migration
- **Status:** complete
- **Started:** 2026-01-24

#### Actions Taken
- Added ~25 new translation keys for category pages to all 5 locale files:
  - Category titles, subtitles, SEO descriptions
  - "No Signal Yet" messages
  - "Asset Breakdown", "Learn More" sections
  - Learn page link titles and descriptions
- Updated `src/pages/crypto/index.astro` with translations
- Updated `src/pages/forex/index.astro` with translations
- Updated `src/pages/stocks/index.astro` with translations
- All pages now accept `locale` prop and pass to child components

#### Files Modified
- `src/i18n/locales/*.json` (all 5 locales) - Added category page keys
- `src/pages/crypto/index.astro` - i18n migration
- `src/pages/forex/index.astro` - i18n migration
- `src/pages/stocks/index.astro` - i18n migration

#### Build Status
- All tests pass, build successful

---

## Session: 2026-01-24 (i18n Implementation)

### Task: i18n Infrastructure
- **Status:** complete (infrastructure deployed)
- **Started:** 2026-01-24

#### Actions Taken
- Created `src/i18n/index.ts` with translation module:
  - `t(key, locale, params)` - translation lookup with interpolation
  - `useTranslations(locale)` - bound translation function
  - `l(path, locale)` - localized link builder
  - `getLocaleFromUrl(url)` - extract locale from pathname
  - `getDirection(locale)` - RTL detection for Arabic
  - `getAlternateUrls()` - generate hreflang URLs for SEO
- Created translation files for 5 locales (~80 keys each):
  - `src/i18n/locales/en.json` (English - base)
  - `src/i18n/locales/es.json` (Spanish)
  - `src/i18n/locales/zh.json` (Chinese Simplified)
  - `src/i18n/locales/ar.json` (Arabic)
  - `src/i18n/locales/pt.json` (Portuguese)
- Configured Astro i18n in `astro.config.mjs`:
  - `prefixDefaultLocale: false` (English at root)
  - Fallback to English for all locales
- Updated `src/lib/i18n.ts` to re-export from new i18n module
- Updated `BaseLayout.astro`:
  - Dynamic `lang` and `dir` attributes
  - hreflang alternate links for SEO
  - `og:locale` meta tag
- Updated `Header.astro` with locale prop and translated nav
- Updated `Footer.astro` with locale prop and translated links
- Migrated homepage (`src/pages/index.astro`) as proof of concept

#### Commit
`32c7ad0` - feat: i18n infrastructure with 5-locale support

#### Next Steps
1. Migrate category pages (crypto, forex, stocks)
2. Migrate signal detail pages
3. Add language switcher component
4. Create localized page routes ([locale]/...)
5. Test RTL layout for Arabic

---

## Session: 2026-01-23 (i18n Planning)

### Task: i18n Planning
- **Status:** complete (superseded by implementation)
- **Started:** 2026-01-23

#### Actions Taken
- Explored codebase to understand i18n scope
- Identified 24 pages and 22 components needing translation
- Estimated ~250 unique strings, 3,500-5,000 words per language
- Selected initial 5 target languages (expanded from 15 to be incremental)
- Documented technical approach (Astro built-in i18n, URL routing, JSON files)

---

## Session: 2026-01-23 (Growth Optimization)

### Task: Growth Optimization for User Acquisition
- **Status:** complete
- **Started:** 2026-01-23
- **Goal:** Attract more users with $0 budget

#### User Requirements
Optimize for:
1. **Google discovery** - Programmatic SEO, learn pages, internal linking
2. **Social sharing** - Share blocks, per-signal OG images
3. **Conversion into Telegram** - Next update teaser, VIP value, CTA tracking
4. **Speed/Trust** - Core Web Vitals, disclaimer, methodology, accuracy

#### Planned Phases
| Phase | Description | Priority |
|-------|-------------|----------|
| G5 | Core Web Vitals audit & optimization | HIGH |
| G1 | Programmatic SEO: Learn pages + internal linking | HIGH |
| G2 | Shareability: Share block + per-signal OG | HIGH |
| G4 | Conversion: Next update + VIP teaser + tracking | HIGH |
| G3 | Distribution: Embeddable widget | MEDIUM-HIGH |
| G6 | Trust: Bigger disclaimer + methodology + accuracy | MEDIUM |

#### Completed Phases

**G5: Core Web Vitals (Complete)**
- Added font preloading in BaseLayout.astro (eliminates render-blocking)
- Removed DM Sans from @import in global.css
- Using `preload as="style"` with onload pattern

**G1: Programmatic SEO (Complete)**
- Created `/learn/glossary.astro` with 15 trading terms + DefinedTermSet schema
- Created `/learn/methodology.astro` with 3-indicator confluence model + HowTo schema
- Added "Learn More" sections to all category pages (crypto, forex, stocks)
- Added glossary links to AssetTable column headers (RSI, Bias, Price)
- Added methodology link to signal detail pages
- Added "What does this mean?" link to MacroBar risk-on/off
- Updated sitemap with new pages

**G2: Shareability (Complete)**
- Created ShareBlock.astro component (X, Reddit, LinkedIn, Copy Link)
- Created per-signal OG image endpoint `/og/signal/[category]/[date]/[time].svg.ts`
- Added ShareBlock to signal detail pages
- Updated signal pages to use per-signal OG images

**G3: Embeddable Widget (Complete)**
- Created `/embed/[category].astro` - iframe-friendly widget endpoint
- Supports `?theme=dark|light` and `?compact=true` parameters
- Categories: crypto, forex, stocks, all
- "Powered by EverInvests" attribution link with UTM tracking
- Created `/embed/index.astro` landing page with copy-paste snippets
- Added widget_view tracking event

**G4: Conversion Optimization (Complete)**
- Created NextUpdateCountdown.astro component with live countdown
- Shows "Next signal in Xh Xm" based on category schedule
- Added "Notify me" CTA linking to Telegram bot
- Added countdown to all category pages (crypto, forex, stocks)
- Created `/api/track.ts` for server-side event tracking
- Updated VIPCTA.astro with server-side tracking (+ existing Zaraz)
- Updated TelegramCTA.astro with tracking
- Events tracked: cta_click, vip_cta_click, telegram_cta_click, share_click, widget_view, page_view

**G6: Trust/Compliance Enhancement (Complete)**
- Reviewed DisclaimerBanner.astro - 7-day dismissal, gradient banner at top
- Reviewed Footer.astro - "Not financial advice" disclaimer with link to /terms
- Reviewed performance.astro - already shows (n=X) sample sizes, statistical significance warnings
- Reviewed methodology.astro - already has limitations section, data sources, update schedule
- All G6 requirements already implemented in previous phases

#### Status
All phases G1-G6 complete. Growth optimization task finished.

---

## Previous Sessions (Archived)

### 2026-01-23: Live News Monitor Enhancement
- Made GDELT "Live News Monitor" always visible in MacroBar
- Three states: Calm (green), Elevated (yellow), High/Critical (red)
- Shows spike ratio and top headlines when elevated

### 2026-01-23: Expert Feedback Implementation (Complete)
- All phases G1-G5 + 1-5 complete
- Quick SEO fixes, evergreen content, OG images
- Security hardening, compliance, APEX preview
- Trust/rigor, UX/ops, test fixes, GDELT enhancement

### 2026-01-22: Regime Detection (Complete)
- All 4 phases of regime detection implemented
- Economic calendar, F&G extremes, VIX thresholds, GDELT geopolitical

### 2026-01-21: Volume-Based Confluence Model (Complete)
- Replaced MA10/MA20 crossover with volume-based independence
- Trend + Volume + Strength model deployed

---

## Test Results
| Test Suite | Tests | Status |
|------------|-------|--------|
| All tests | 87 | PASS |

## Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
| (none yet) | | | |

---

*Update after completing each phase or encountering errors*
