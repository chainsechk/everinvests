# Task Plan: EverInvests Implementation

## Goal
Build a complete market signal broadcast site with automated daily signals for Crypto, Forex, and Stocks.

## Current Phase
**ALL PHASES COMPLETE - PRODUCTION SIGNALS VERIFIED**

- Pages: https://everinvests.com
- Worker: https://everinvests-worker.duyuefeng0708.workers.dev

### Status (2026-01-16)
- D1 binding: Working
- APIs: All returning correct JSON
- Frontend: All pages rendering with data
- SEO: Sitemap and meta tags in place
- **Signal Generation: FULLY OPERATIONAL**
  - Crypto: ✅ CoinGecko API (BTC, ETH)
  - Forex: ✅ TwelveData API (USD/JPY, EUR/USD)
  - Stocks: ✅ TwelveData API (NVDA, MSFT, XOM, ORCL, AAPL)
  - Telegram: ✅ Notifications working

See: `docs/plans/2026-01-15-frontend-ui-implementation.md` for frontend details.

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
