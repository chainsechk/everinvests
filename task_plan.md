# Task Plan: Signal API Foundation Implementation

## Goal
Build API endpoints (`/api/today/[category]` and `/api/history/[category]`) that return the latest and historical signals for crypto/forex/stocks from Cloudflare D1.

## Current Phase
Phase 4 (Task 6 next)

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
- [ ] Task 6: Create src/env.d.ts (type definitions)
- [ ] Task 7: Create src/lib/db/types.ts + tests
- [ ] Task 8: Create src/lib/db/queries.ts + tests
- [ ] Task 9: Create src/lib/db/client.ts + tests
- **Status:** pending

### Phase 4: API Routes (Tasks 6-8)
- [ ] Add normalizeCategory helper
- [ ] Create /api/today/[category].ts
- [ ] Create /api/history/[category].ts
- [ ] Test all routes
- **Status:** pending

### Phase 5: Documentation (Task 9)
- [ ] Create docs/api.md
- [ ] Update README.md
- **Status:** pending

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
