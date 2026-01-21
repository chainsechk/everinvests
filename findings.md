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

## Signal Indicator Confluence (First Principles)

**Problem:** Raw values like `vsMA20: "above"` are not actionable.
- Is "above MA20" significant? Depends on how far above
- What about momentum? Need multiple indicators

**Solution:** Expose **interpreted signals** showing confluence:
```json
{
  "indicators": {
    "trend": { "signal": "bullish", "position": "above" },
    "momentum": { "signal": "neutral", "value": "54.8", "type": "rsi" }
  },
  "confluence": "1/2 bullish"
}
```

**Signal Derivation (from bias.ts):**
- **Trend:** Price vs 20D MA with 1% threshold
  - `> +1%` → bullish, `< -1%` → bearish, else neutral
- **Momentum:** RSI (forex/stocks) or Funding Rate (crypto)
  - RSI: `< 30` → bullish (oversold), `> 70` → bearish (overbought)
  - Funding: `< 0.01%` → bullish, `> 0.05%` → bearish

**Bias Rule:** 2/2 bullish = Bullish, 2/2 bearish = Bearish, else Neutral

## IMPORTANT: Rate Limit Distinction
**External APIs (worker/src/data/*.ts) - RATE LIMITED, MUST BE SEQUENTIAL:**
- TwelveData: 8 req/min - forex/stocks price, SMA, RSI
- Alpha Vantage: 25 req/day - DXY, VIX, yields
- CoinGecko: Soft limits - crypto price/MA
- These calls in worker MUST remain sequential with delays!

**D1 Database (src/pages/*.astro) - NO RATE LIMITS, CAN PARALLELIZE:**
- All queries to `Astro.locals.runtime?.env?.DB` are local SQLite
- Safe to use Promise.all() for D1 queries
- Example: performance.astro parallelizes D1 queries safely

**Don't confuse these two!** Future agents: check if code is calling D1 or external APIs before deciding on parallelization.

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

### Funnel States (Progressive)
| State | CTA Points To | VIP Status |
|-------|---------------|------------|
| **Pre-Launch** | Waitlist (TG bot or form) | Not built yet |
| Soft Launch | Edge bot (limited access) | MVP ready |
| Live | Edge bot (open subscriptions) | Full product |

**Current state:** Pre-Launch (waitlist mode)

### CTA Configuration
Environment-based switching between modes:
```toml
# wrangler.toml
[vars]
VIP_CTA_MODE = "waitlist"  # Options: "waitlist", "live", "none"
```

### Waitlist Mode CTA
```
━━━━━━━━━━━━━━━━━━━━━━━━
🚀 EverInvests VIP launching soon
Regime analysis • Confidence scores • Directives
👉 Join waitlist: t.me/EverInvestsBot?start=waitlist
```

### Live Mode CTA (when VIP ready)
```
━━━━━━━━━━━━━━━━━━━━━━━━
Want regime + confidence + directives?
👉 Join EverInvests VIP: t.me/EverInvestsVIPBot
```

### Expanded Free Sources Strategy

**Current free sources (limited):**
- DXY, VIX, 10Y (Alpha Vantage)
- Price, MA20, RSI (TwelveData)
- Funding rate (Binance)

**To add (expand free tier value):**
| Source | Data | Why Add |
|--------|------|---------|
| Alternative.me | BTC Fear & Greed | Sentiment |
| CoinGecko | BTC Dominance | Alt season indicator |
| FRED | 2Y-10Y Spread | Recession indicator |
| FRED | Fed Funds Rate | Rate cycle |
| TwelveData | Gold (XAU/USD) | Risk-off proxy |

**Differentiation principle:**
- Free = Rich data + Simple output (Bias)
- VIP = Premium sources + Complex analysis (Regime, Directives)

### Design Files
- `docs/plans/2026-01-20-vip-bridge-design.md` - Full architecture (v6.0)
- `docs/plans/2026-01-20-vip-bridge-implementation.md` - Implementation tasks (v3.0)

---
*Update this file after every 2 view/browser/search operations*
