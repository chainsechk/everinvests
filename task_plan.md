# Task Plan: EverInvests Implementation

## Goal
Build a complete market signal broadcast site with automated daily signals for Crypto, Forex, and Stocks.

## Current Phase
**VIP Bridge: Waitlist Funnel + Expanded Free Sources**

- Pages: https://everinvests.com
- Worker: https://everinvests-worker.duyuefeng0708.workers.dev

### Status (2026-01-20)
- **Free Tier: FULLY OPERATIONAL**
  - Signal Generation: ✅ Crypto, Forex, Stocks
  - Telegram Channel: ✅ Free notifications working
  - Website: ✅ All pages live
- **VIP Bridge: COMPLETE**
  - CTA Configuration: ✅ waitlist/live/none modes
  - TG Message CTA: ✅ Configurable CTA in messages
  - Website CTA: ✅ VIPCTA component on all pages
  - SEO Updates: ✅ JSON-LD schemas, meta descriptions
  - Expanded Sources: ✅ F&G, BTC Dom, Gold, Yield Spread
  - Analytics: ✅ Click tracking in CTA
  - OG Images: ✅ Dynamic SVG endpoint

### Funnel States
| State | CTA Points To | Status |
|-------|---------------|--------|
| **Pre-Launch** | Waitlist (collect interest) | ← CURRENT |
| Soft Launch | Edge bot (beta testers) | Pending |
| Live | Edge bot (open subscriptions) | Pending |

See: `docs/plans/2026-01-20-vip-bridge-design.md` for architecture
See: `docs/plans/2026-01-20-vip-bridge-implementation.md` for tasks

---

## VIP Bridge Progress (2026-01-20)

**Goal:** Prepare free tier for VIP funnel + expand free data sources

### Phase 0: CTA Configuration - COMPLETE
- [x] Add VIP_CTA_MODE env var to wrangler.toml
- [x] Create config.ts with waitlist/live/none modes
- [x] Added getCTAMode and getCTAConfig helpers

### Phase 1: TG Message CTA - COMPLETE
- [x] Update notifyTelegram.ts with configurable CTA
- [x] Changed "Signal:" to "Bias:" in message format
- [x] Added CTA to end of TG messages (configurable by mode)
- [x] Updated notifyTelegramSkill to v3 with CTA support

### Phase 2: Website CTA - COMPLETE
- [x] Create VIPCTA.astro component (waitlist mode)
- [x] Add CTA to /crypto, /forex, /stocks pages
- [x] Add CTA to homepage
- [x] Style matches site theme with vip color

### Phase 3: SEO Updates - COMPLETE
- [x] Update meta descriptions (homepage + category pages)
- [x] Add structured data (BreadcrumbList + Service schemas)

### Phase 4: Expand Free Sources - COMPLETE
- [x] Implement: BTC Fear & Greed (Alternative.me)
- [x] Implement: BTC Dominance (CoinGecko)
- [x] Implement: Gold price (TwelveData)
- [x] Implement: 2Y-10Y Spread (FRED)
- [x] Update MacroData types with expanded fields
- [x] Update fetchMacroDataSkill to v3 with new sources
- [x] Update MacroBar UI to display expanded indicators

### Phase 5: Analytics - COMPLETE
- [x] UTM parameters via Telegram start param (already in place)
- [x] Click tracking script in VIPCTA component

---

## Growth Plan Progress (2026-01-16 Plan)

### Phase 1: Measurement Foundation - COMPLETE
- [x] Task 1: Signal Accuracy Tracking (signal_outcomes table, accuracy API)
- [x] Task 2: Cloudflare Analytics + Event Tracking (events table)
- [x] Task 6: Live Stats Component (/api/stats endpoint)
- Commit: `caa7eff feat: add signal accuracy tracking (Phase 1 Tasks 1-2, 6)`

### Phase 2: Content Automation - COMPLETE
- [x] Task 3: Auto-Generated Blog Posts (2026-01-19)
  - Created `blog_posts` table (migration 0004)
  - **Weekly summaries** (not per-signal) - runs Sundays 23:00 UTC
  - Created `worker/src/blog/weekly.ts` - aggregates week's signals
  - Created `/blog` index page and `/blog/[slug]` dynamic page
  - Manual trigger: `/generate-weekly-blog` endpoint
  - Deployed worker and frontend
- [x] Task 5: Shareable Signal Cards (OG Images) (2026-01-20)
  - Created `/api/og/[category].svg` dynamic endpoint
  - SVG shows category icon, bias with color, date/time, branding
  - 5-minute cache for optimal performance
  - Category pages now use dynamic OG images

### Phase 3: Social Proof - PENDING
- [ ] Task 7: Performance Page

### Phase 4: Distribution Expansion - PENDING
- [ ] Task 8: Telegram Channel Enhancement
- [ ] Task 9: RSS Feed
- [ ] Task 10: Webhook System

### Phase 5: Agent-Native Features - PENDING
- [ ] Task 11: MCP Server
- [ ] Task 12: Structured API

### Phase 6: Social Distribution - LOW PRIORITY (LAST)
- [ ] Task 4: X/Twitter Auto-Posting (via Zapier free tier)
  - Requires webhook trigger from worker
  - Can wait until other features complete

---

## Backend Complete (Phases 1-7)
- API endpoints: `/api/today/{cat}`, `/api/history/{cat}`, `/api/macro`
- D1 database with 4 tables, 5 indexes
- Signal generation worker with full pipeline
- 15 passing tests

## Frontend Pending (Phases 8-14)
| Phase | Description | Tasks |
|-------|-------------|-------|
| 8 | Styling + Layout | Tailwind, BaseLayout, Header, Footer |
| 9 | Home Page | MacroBar, SignalCard, TelegramCTA |
| 10 | Category Pages | BiasIndicator, SignalDetail, AssetTable, HistoryMini |
| 11 | History Pages | HistoryList component, 3 history pages |
| 12 | About Page | Methodology + CTA |
| 13 | Production Deploy | Secrets, deploy, E2E verification |
| 14 | SEO & Polish | Meta tags, sitemap, performance |

---

## Completed Phases

### Phase 7: Signal Generation Pipeline (Tasks 18-23)
- [x] Task 18: Create data fetching modules (Binance, TwelveData, AlphaVantage)
- [x] Task 19: Create bias calculation module
- [x] Task 20: Create macro context calculation
- [x] Task 21: Create LLM summary generation
- [x] Task 22: Create Telegram notification module
- [x] Task 23: Wire up pipeline in index.ts
- Commit: `d33833c feat: implement signal generation pipeline`
- **Status:** complete

## Phases

### Phase 1: Orientation + Verify Scaffolding (Task 1)
- [x] Read CLAUDE.md and design.md
- [x] Understand signal categories, schedules, API shape
- [x] Check whether Astro project exists → NO, empty repo
- [x] Document current project state
- **Status:** complete

### Phase 2: Scaffold Astro + Test Harness (Task 2)
- [x] Create package.json with scripts
- [x] Create astro.config.mjs
- [x] Create tsconfig.json
- [x] Create vitest.config.ts
- [x] Create src/pages/index.astro
- [x] Create smoke test
- [x] Run npm install && npm test → PASS (1 test)
- [x] Commit: `12d4a00 chore: scaffold astro app and tests`
- **Status:** complete

### Phase 3: D1 Infrastructure (Tasks 3-5)
- [x] Task 3: Create D1 database (`everinvests-db`, id: `92386766-33b5-4dc8-a594-abf6fc4e6600`)
- [x] Task 4: Create migrations/0001_init.sql, apply local + remote
- [x] Task 5: Create wrangler.toml with D1 binding
- [x] Commit: `3fe1144 chore: add D1 schema migrations and wrangler config`
- **Status:** complete

### Phase 4: D1 Query Layer (Tasks 6-9)
- [x] Task 6: Create src/env.d.ts (type definitions)
- [x] Task 7: Create src/lib/db/types.ts + tests
- [x] Task 8: Create src/lib/db/queries.ts + tests
- [x] Task 9: Create src/lib/db/client.ts + index.ts + tests
- Commits:
  - `a8d6328 chore: add Cloudflare runtime type definitions`
  - `7c667c4 feat: add D1 type definitions and category normalization`
  - `724f75d feat: add SQL query builders for signals`
  - `18de880 feat: add typed D1 client functions`
- **Status:** complete

### Phase 5: API Routes (Tasks 10-13)
- [x] Task 10: Create /api/today/[category].ts + tests
- [x] Task 11: Create /api/history/[category].ts + tests
- [x] Task 12: Create /api/macro.ts + tests
- [x] Task 13: Create src/lib/api/types.ts (API response types)
- Commits:
  - `7a7207a feat: add /api/today/[category] endpoint`
  - `dc9899b feat: add /api/history/[category] endpoint`
  - `97c239e feat: add /api/macro endpoint`
- **Status:** complete

### Phase 6: Signal Generation Worker (Tasks 13-17)
- [x] Task 13: Scaffold Worker project
- [x] Task 14: Create worker environment file
- [x] Task 15: Add development scripts
- [x] Task 16: Create seed data script
- [x] Task 17: Document local development workflow
- Commits:
  - `8bd5058 chore: scaffold signal generation worker`
  - `35e79ad chore: add worker env template and gitignore`
  - `97abe37 chore: add development convenience scripts`
  - `7f71a9f chore: add local development seed data`
  - `ae08ab5 docs: add local development guide`
- **Status:** complete

## Key Questions
1. Is there an existing Astro project or empty repo? → **Empty repo, need full scaffold**
2. What Astro adapter version for Cloudflare? → Need to determine
3. How to bind D1 to locals.db in Astro? → Via @astrojs/cloudflare adapter

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Astro SSR + Cloudflare adapter | Native CF integration, good SEO |
| D1 SQLite | Edge database, free tier sufficient |
| Vitest for tests | Fast, ESM-native, works with Astro |
| TDD approach | Plan specifies write test first |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| npm: command not found | 1 | User installed Node.js v18.19.1 |

## Notes
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions
- Log ALL errors - they help avoid repetition
