# Findings & Decisions

## Requirements
- API endpoints for signals: `/api/today/[category]` and `/api/history/[category]`
- Categories: crypto, forex, stocks
- D1 database with tables: macro_signals, signals, asset_signals, run_logs
- Astro SSR on Cloudflare Pages
- TypeScript throughout
- Vitest for unit tests

## Research Findings

### Phase 2 Complete (2026-01-17)

**TTL Cache Implementation:**
- worker/src/cache/ttl.ts: Cloudflare Cache API integration
- TTL: 5 min for quotes, 15 min for SMA/RSI, 60 min for macro
- Cache hit tracking and staleness detection built-in

**Quality Checks Enhanced:**
- QualityFlags: `missing_assets`, `macro_fallback`, `macro_stale`, `stale_assets`, `outlier_values`
- Outlier detection: price vs MA deviation, extreme RSI, extreme funding rate
- Thresholds: 50% MA deviation, RSI 5-95, 1% funding rate

**Data Fetching Updated:**
- TwelveData: cached fetch, returns cacheHits and staleAssets
- AlphaVantage: cached fetch, returns cached and isStale flags
- Skills updated to v2 with new output fields

**UI Updated:**
- SignalDetail.astro: shows all quality flag types
- AssetTable.astro: shows stale/outlier icons per asset with tooltips
- Category pages pass qualityFlags to AssetTable

**Tests Added:**
- tests/worker/quality-checks.test.ts (20 tests)
- All 37 tests passing

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
| Binance API blocked by CF Workers | Migrated to CoinGecko API for crypto data |
| CoinGecko requires User-Agent header | Added `User-Agent: EverInvests/1.0` to fetch |
| TwelveData 8 req/min rate limit | Reduced stocks to 5 key tickers, sequential calls |
| Worker secrets vs Pages secrets | Must deploy secrets to both separately |
| Binance funding rate wrong domain | Fixed: `fapi.binance.com` not `api.binance.com` |

## Resources
- Implementation plan: `docs/plans/2026-01-14-signal-api-foundation.md`
- Design doc: `docs/plans/2026-01-14-everinvests-design.md`
- Schema: See design.md Section 5

## Visual/Browser Findings
- N/A (no browser operations yet)

## VIP Bridge (2026-01-20)

### Scope Clarification
- **This repo (everinvests):** Free site + Free TG channel only
- **Separate project:** EverInvests VIP (paid TG group, edge bot, premium signals)
- **"VIP Bridge":** CTAs added to free tier that funnel users to paid VIP

### Product Tiers
| Tier | Channel | Model | Repo |
|------|---------|-------|------|
| EverInvests (Free) | Website + Free TG Channel | Free | this repo |
| EverInvests VIP | Private TG Group | $49-399/mo | separate |

### Payment Flow (VIP - separate project)
1. CTA links to **edge bot** (e.g., `t.me/EverInvestsVIPBot` - TBD)
2. User subscribes via edge bot (powered by **MemberPaywall.org**)
3. Edge bot generates **private invite link** to VIP group
4. User joins VIP group

**Key:** VIP group is private - no public t.me link. All invites generated per-user by edge bot.

### CTA = Call To Action
Marketing element in FREE tier prompting users to upgrade:
```
━━━━━━━━━━━━━━━━━━━━━━━━
Want regime + confidence + directives?
👉 Join EverInvests VIP: [bot link TBD]
```

### Design Files
- `docs/plans/2026-01-20-vip-bridge-design.md` - Full architecture
- `docs/plans/2026-01-20-vip-bridge-implementation.md` - Implementation tasks

---
*Update this file after every 2 view/browser/search operations*
