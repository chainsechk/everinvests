# Findings & Decisions

## Requirements
- API endpoints for signals: `/api/today/[category]` and `/api/history/[category]`
- Categories: crypto, forex, stocks
- D1 database with tables: macro_signals, signals, asset_signals, run_logs
- Astro SSR on Cloudflare Pages
- TypeScript throughout
- Vitest for unit tests

## Research Findings

### Project State (Task 1 Discovery)
- **Empty repo** - no Astro scaffolding exists
- Only docs present: CLAUDE.md, design.md, docs/plans/
- No package.json, no src/ directory
- **Action needed**: Full Astro scaffold required (Task 2)

### From design.md
- **Crypto**: BTC, ETH - updates at 00:00, 08:00, 16:00 UTC
- **Forex**: USD/JPY, EUR/USD, USD/CAD, USD/AUD - 00:00, 08:00, 14:00 weekdays
- **Stocks**: 25 tickers - 17:00, 21:00 weekdays
- Signal output: Macro context, Bias, Key Levels, Triggers, Risks, Summary, Timestamp

### DB Schema (signals table)
```sql
CREATE TABLE signals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  category      TEXT NOT NULL,           -- 'crypto' | 'forex' | 'stocks'
  date          TEXT NOT NULL,
  time_slot     TEXT NOT NULL,           -- '08:00'
  generated_at  TEXT NOT NULL,
  bias          TEXT NOT NULL,
  macro_id      INTEGER REFERENCES macro_signals(id),
  data_json     TEXT,
  output_json   TEXT,                    -- levels, triggers, risks, summary
  UNIQUE(category, date, time_slot)
);
```

### API Shape
- `GET /api/today/[category]` → Returns latest signal for category
- `GET /api/history/[category]?limit=N` → Returns N most recent signals (default 7, max 30)

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Category normalization | Only accept 'crypto', 'forex', 'stocks' - return 404 for others |
| Limit validation | 1-30 range, default 7 |
| D1 binding via locals.db | Astro Cloudflare adapter pattern |

## D1 Database
- **database_name**: `everinvests-db`
- **database_id**: `92386766-33b5-4dc8-a594-abf6fc4e6600`
- **region**: EEUR
- **created**: 2026-01-14

## Issues Encountered
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
- Implementation plan: `docs/plans/2026-01-14-signal-api-foundation.md`
- Design doc: `docs/plans/2026-01-14-everinvests-design.md`
- Schema: See design.md Section 5

## Visual/Browser Findings
- N/A (no browser operations yet)

---
*Update this file after every 2 view/browser/search operations*
