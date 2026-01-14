# Signal API Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use @superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the complete Cloudflare infrastructure (D1 + Workers + Pages) and API endpoints that return the latest and historical signals for crypto/forex/stocks.

**Architecture:**
- **D1:** `everinvests-db` - Shared database for signals and logs
- **Worker:** `everinvests-worker` - Cron Trigger (hourly), signal generation, writes to D1, Telegram notifications
- **Pages (Astro SSR):** `everinvests-site` - SEO pages, read-only D1 access

**Tech Stack:** Astro (SSR), TypeScript, Cloudflare D1 (SQLite), Cloudflare Workers, Workers AI, Vitest (unit tests), Wrangler.

---

## Phase 1: Infrastructure Setup

### Task 1: Verify existing scaffolding and dependencies

**Files:**
- Read: `package.json`, `astro.config.mjs`, `tsconfig.json`

**Step 1: Confirm Astro + Cloudflare adapter installed**

Run: `ls -la && cat package.json`
Expected: `@astrojs/cloudflare` and `wrangler` in dependencies.

**Step 2: Verify wrangler is logged in**

Run: `wrangler whoami`
Expected: Shows your Cloudflare account email.

**Step 3: No commit**

Observation-only step.

---

### Task 2: Create D1 database

**Files:**
- None (Cloudflare platform)

**Step 1: Create the D1 database**

Run: `wrangler d1 create everinvests-db`
Expected: Output contains `database_id = "xxxxx-xxxx-xxxx-xxxx-xxxxxxxxxx"`. Save this ID.

**Step 2: Verify database exists**

Run: `wrangler d1 list`
Expected: `everinvests-db` appears in the list.

**Step 3: No commit**

Platform configuration only.

---

### Task 3: Create D1 migrations

**Files:**
- Create: `migrations/0001_init.sql`

**Step 1: Write the migration file**

```sql
-- migrations/0001_init.sql
-- Shared macro context (generated per scheduled time)
CREATE TABLE macro_signals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  date          TEXT NOT NULL,
  time_slot     TEXT NOT NULL,
  generated_at  TEXT NOT NULL,
  dxy_bias      TEXT,
  vix_level     TEXT,
  yields_bias   TEXT,
  overall       TEXT,
  data_json     TEXT,
  UNIQUE(date, time_slot)
);

-- Category-level signals
CREATE TABLE signals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  category      TEXT NOT NULL,
  date          TEXT NOT NULL,
  time_slot     TEXT NOT NULL,
  generated_at  TEXT NOT NULL,
  bias          TEXT NOT NULL,
  macro_id      INTEGER REFERENCES macro_signals(id),
  data_json     TEXT,
  output_json   TEXT,
  UNIQUE(category, date, time_slot)
);

-- Per-asset breakdown
CREATE TABLE asset_signals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  signal_id     INTEGER NOT NULL REFERENCES signals(id),
  ticker        TEXT NOT NULL,
  bias          TEXT,
  price         REAL,
  vs_20d_ma     TEXT,
  secondary_ind TEXT,
  data_json     TEXT
);

-- Run logs for observability
CREATE TABLE run_logs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  category      TEXT,
  time_slot     TEXT,
  run_at        TEXT NOT NULL,
  status        TEXT NOT NULL,
  duration_ms   INTEGER,
  error_msg     TEXT
);

-- Indexes for common queries
CREATE INDEX idx_signals_category_date ON signals(category, date);
CREATE INDEX idx_asset_signals_ticker ON asset_signals(ticker);
CREATE INDEX idx_asset_signals_signal_id ON asset_signals(signal_id);
CREATE INDEX idx_macro_date ON macro_signals(date);
CREATE INDEX idx_run_logs_run_at ON run_logs(run_at);
```

**Step 2: Apply migration to local D1**

Run: `wrangler d1 migrations apply everinvests-db --local`
Expected: `Migrations to be applied: 0001_init.sql` then success.

**Step 3: Apply migration to remote D1**

Run: `wrangler d1 migrations apply everinvests-db --remote`
Expected: Success message showing tables created.

**Step 4: Commit**

Run:
- `git add migrations/`
- `git commit -m "chore: add D1 schema migrations"`

---

### Task 4: Configure wrangler.toml for Pages with D1 binding

**Files:**
- Create: `wrangler.toml`

**Step 1: Create wrangler.toml**

```toml
# wrangler.toml
name = "everinvests-site"
compatibility_date = "2026-01-14"

[[d1_databases]]
binding = "DB"
database_name = "everinvests-db"
database_id = "<YOUR_DATABASE_ID_FROM_TASK_2>"
preview_database_id = "DB"
```

Replace `<YOUR_DATABASE_ID_FROM_TASK_2>` with the actual database_id from Task 2.

**Step 2: Verify local D1 binding works**

Run: `wrangler pages dev dist --d1=DB=everinvests-db`
Expected: Dev server starts with D1 binding available.

**Step 3: Commit**

Run:
- `git add wrangler.toml`
- `git commit -m "chore: add wrangler config with D1 binding"`

---

### Task 5: Create environment type definitions

**Files:**
- Create: `src/env.d.ts`

**Step 1: Write type definitions for Cloudflare bindings**

```ts
// src/env.d.ts
/// <reference types="astro/client" />

type D1Database = import("@cloudflare/workers-types").D1Database;

declare namespace App {
  interface Locals {
    runtime: {
      env: {
        DB: D1Database;
      };
    };
  }
}
```

**Step 2: Verify TypeScript recognizes types**

Run: `npx tsc --noEmit`
Expected: No type errors.

**Step 3: Commit**

Run:
- `git add src/env.d.ts`
- `git commit -m "chore: add Cloudflare runtime type definitions"`

---

## Phase 2: Database Query Layer

### Task 6: Add D1 type definitions

**Files:**
- Create: `src/lib/db/types.ts`
- Test: `tests/db/types.test.ts`

**Step 1: Write the failing test**

```ts
// tests/db/types.test.ts
import { describe, it, expect } from "vitest";
import { normalizeCategory, type Category } from "../../src/lib/db/types";

describe("normalizeCategory", () => {
  it("returns valid category for known values", () => {
    expect(normalizeCategory("crypto")).toBe("crypto");
    expect(normalizeCategory("forex")).toBe("forex");
    expect(normalizeCategory("stocks")).toBe("stocks");
  });

  it("returns null for unknown values", () => {
    expect(normalizeCategory("metals")).toBeNull();
    expect(normalizeCategory("")).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/db/types.test.ts`
Expected: FAIL with "Cannot find module".

**Step 3: Write minimal implementation**

```ts
// src/lib/db/types.ts
export const categories = ["crypto", "forex", "stocks"] as const;
export type Category = (typeof categories)[number];

export function normalizeCategory(value: string): Category | null {
  return categories.includes(value as Category) ? (value as Category) : null;
}

export interface MacroSignalRow {
  id: number;
  date: string;
  time_slot: string;
  generated_at: string;
  dxy_bias: string | null;
  vix_level: string | null;
  yields_bias: string | null;
  overall: string | null;
  data_json: string | null;
}

export interface SignalRow {
  id: number;
  category: Category;
  date: string;
  time_slot: string;
  generated_at: string;
  bias: string;
  macro_id: number | null;
  data_json: string | null;
  output_json: string | null;
}

export interface AssetSignalRow {
  id: number;
  signal_id: number;
  ticker: string;
  bias: string | null;
  price: number | null;
  vs_20d_ma: string | null;
  secondary_ind: string | null;
  data_json: string | null;
}

export interface RunLogRow {
  id: number;
  category: string | null;
  time_slot: string | null;
  run_at: string;
  status: string;
  duration_ms: number | null;
  error_msg: string | null;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/db/types.test.ts`
Expected: PASS.

**Step 5: Commit**

Run:
- `git add src/lib/db/types.ts tests/db/types.test.ts`
- `git commit -m "feat: add D1 type definitions and category normalization"`

---

### Task 7: Add SQL query builders

**Files:**
- Create: `src/lib/db/queries.ts`
- Test: `tests/db/queries.test.ts`

**Step 1: Write the failing test**

```ts
// tests/db/queries.test.ts
import { describe, it, expect } from "vitest";
import { latestSignalSql, historySignalSql, assetSignalsSql } from "../../src/lib/db/queries";

describe("SQL query builders", () => {
  it("latestSignalSql selects latest by category", () => {
    const sql = latestSignalSql();
    expect(sql).toContain("WHERE category = ?");
    expect(sql).toContain("ORDER BY date DESC, time_slot DESC");
    expect(sql).toContain("LIMIT 1");
  });

  it("historySignalSql selects with limit", () => {
    const sql = historySignalSql();
    expect(sql).toContain("WHERE category = ?");
    expect(sql).toContain("LIMIT ?");
  });

  it("assetSignalsSql selects by signal_id", () => {
    const sql = assetSignalsSql();
    expect(sql).toContain("WHERE signal_id = ?");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/db/queries.test.ts`
Expected: FAIL with "Cannot find module".

**Step 3: Write minimal implementation**

```ts
// src/lib/db/queries.ts
export function latestSignalSql(): string {
  return `
    SELECT s.*, m.overall as macro_overall
    FROM signals s
    LEFT JOIN macro_signals m ON s.macro_id = m.id
    WHERE s.category = ?
    ORDER BY s.date DESC, s.time_slot DESC
    LIMIT 1
  `;
}

export function historySignalSql(): string {
  return `
    SELECT s.*, m.overall as macro_overall
    FROM signals s
    LEFT JOIN macro_signals m ON s.macro_id = m.id
    WHERE s.category = ?
    ORDER BY s.date DESC, s.time_slot DESC
    LIMIT ?
  `;
}

export function assetSignalsSql(): string {
  return `
    SELECT *
    FROM asset_signals
    WHERE signal_id = ?
    ORDER BY ticker ASC
  `;
}

export function latestMacroSql(): string {
  return `
    SELECT *
    FROM macro_signals
    ORDER BY date DESC, time_slot DESC
    LIMIT 1
  `;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/db/queries.test.ts`
Expected: PASS.

**Step 5: Commit**

Run:
- `git add src/lib/db/queries.ts tests/db/queries.test.ts`
- `git commit -m "feat: add SQL query builders for signals"`

---

### Task 8: Add typed database client functions

**Files:**
- Create: `src/lib/db/client.ts`
- Test: `tests/db/client.test.ts`

**Step 1: Write the failing test**

```ts
// tests/db/client.test.ts
import { describe, it, expect, vi } from "vitest";
import { getLatestSignal, getSignalHistory } from "../../src/lib/db/client";

describe("getLatestSignal", () => {
  it("returns null when no rows", async () => {
    const mockDb = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn().mockResolvedValue(null),
        })),
      })),
    } as any;

    const result = await getLatestSignal(mockDb, "crypto");
    expect(result).toBeNull();
    expect(mockDb.prepare).toHaveBeenCalled();
  });
});

describe("getSignalHistory", () => {
  it("returns empty array when no rows", async () => {
    const mockDb = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          all: vi.fn().mockResolvedValue({ results: [] }),
        })),
      })),
    } as any;

    const result = await getSignalHistory(mockDb, "crypto", 7);
    expect(result).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/db/client.test.ts`
Expected: FAIL with "Cannot find module".

**Step 3: Write minimal implementation**

```ts
// src/lib/db/client.ts
import type { Category, SignalRow, AssetSignalRow, MacroSignalRow } from "./types";
import { latestSignalSql, historySignalSql, assetSignalsSql, latestMacroSql } from "./queries";

type D1Database = import("@cloudflare/workers-types").D1Database;

export interface SignalWithMacro extends SignalRow {
  macro_overall: string | null;
}

export async function getLatestSignal(
  db: D1Database,
  category: Category
): Promise<SignalWithMacro | null> {
  const row = await db
    .prepare(latestSignalSql())
    .bind(category)
    .first<SignalWithMacro>();
  return row ?? null;
}

export async function getSignalHistory(
  db: D1Database,
  category: Category,
  limit: number
): Promise<SignalWithMacro[]> {
  const { results } = await db
    .prepare(historySignalSql())
    .bind(category, limit)
    .all<SignalWithMacro>();
  return results ?? [];
}

export async function getAssetSignals(
  db: D1Database,
  signalId: number
): Promise<AssetSignalRow[]> {
  const { results } = await db
    .prepare(assetSignalsSql())
    .bind(signalId)
    .all<AssetSignalRow>();
  return results ?? [];
}

export async function getLatestMacro(
  db: D1Database
): Promise<MacroSignalRow | null> {
  const row = await db.prepare(latestMacroSql()).first<MacroSignalRow>();
  return row ?? null;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/db/client.test.ts`
Expected: PASS.

**Step 5: Commit**

Run:
- `git add src/lib/db/client.ts tests/db/client.test.ts`
- `git commit -m "feat: add typed D1 client functions"`

---

### Task 9: Create db index file

**Files:**
- Create: `src/lib/db/index.ts`

**Step 1: Write the index file**

```ts
// src/lib/db/index.ts
export * from "./types";
export * from "./queries";
export * from "./client";
```

**Step 2: Verify import works**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 3: Commit**

Run:
- `git add src/lib/db/index.ts`
- `git commit -m "chore: add db module index"`

---

## Phase 3: API Routes

### Task 10: Create `/api/today/[category]` route

**Files:**
- Create: `src/pages/api/today/[category].ts`
- Test: `tests/api/today.test.ts`

**Step 1: Write the failing test**

```ts
// tests/api/today.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Response globally
class MockResponse {
  body: string;
  init: ResponseInit;
  constructor(body: string, init: ResponseInit = {}) {
    this.body = body;
    this.init = init;
  }
  static json(data: unknown, init?: ResponseInit) {
    return new MockResponse(JSON.stringify(data), init);
  }
}
vi.stubGlobal("Response", MockResponse);

import { GET } from "../../src/pages/api/today/[category]";

describe("GET /api/today/[category]", () => {
  it("returns 404 for invalid category", async () => {
    const context = {
      params: { category: "metals" },
      locals: { runtime: { env: {} } },
    } as any;

    const response = await GET(context);
    expect(response.init?.status).toBe(404);
  });

  it("returns 500 when DB not configured", async () => {
    const context = {
      params: { category: "crypto" },
      locals: { runtime: { env: {} } },
    } as any;

    const response = await GET(context);
    expect(response.init?.status).toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/api/today.test.ts`
Expected: FAIL with "Cannot find module".

**Step 3: Write minimal implementation**

```ts
// src/pages/api/today/[category].ts
import type { APIContext } from "astro";
import { normalizeCategory } from "../../../lib/db/types";
import { getLatestSignal, getAssetSignals } from "../../../lib/db/client";

export async function GET(context: APIContext) {
  const { category: rawCategory } = context.params;
  const category = normalizeCategory(rawCategory ?? "");

  if (!category) {
    return Response.json(
      { error: "unknown category", valid: ["crypto", "forex", "stocks"] },
      { status: 404 }
    );
  }

  const db = context.locals.runtime?.env?.DB;
  if (!db) {
    return Response.json(
      { error: "database not configured" },
      { status: 500 }
    );
  }

  const signal = await getLatestSignal(db, category);
  if (!signal) {
    return Response.json(
      { error: "no signal available", category },
      { status: 404 }
    );
  }

  const assets = await getAssetSignals(db, signal.id);

  return Response.json({
    signal: {
      ...signal,
      data: signal.data_json ? JSON.parse(signal.data_json) : null,
      output: signal.output_json ? JSON.parse(signal.output_json) : null,
    },
    assets: assets.map((a) => ({
      ...a,
      data: a.data_json ? JSON.parse(a.data_json) : null,
    })),
    macro: signal.macro_overall,
  });
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/api/today.test.ts`
Expected: PASS.

**Step 5: Commit**

Run:
- `git add src/pages/api/today/[category].ts tests/api/today.test.ts`
- `git commit -m "feat: add /api/today/[category] endpoint"`

---

### Task 11: Create `/api/history/[category]` route

**Files:**
- Create: `src/pages/api/history/[category].ts`
- Test: `tests/api/history.test.ts`

**Step 1: Write the failing test**

```ts
// tests/api/history.test.ts
import { describe, it, expect, vi } from "vitest";

class MockResponse {
  body: string;
  init: ResponseInit;
  constructor(body: string, init: ResponseInit = {}) {
    this.body = body;
    this.init = init;
  }
  static json(data: unknown, init?: ResponseInit) {
    return new MockResponse(JSON.stringify(data), init);
  }
}
vi.stubGlobal("Response", MockResponse);

import { GET } from "../../src/pages/api/history/[category]";

describe("GET /api/history/[category]", () => {
  it("returns 404 for invalid category", async () => {
    const context = {
      params: { category: "metals" },
      request: new Request("https://example.com/api/history/metals"),
      locals: { runtime: { env: {} } },
    } as any;

    const response = await GET(context);
    expect(response.init?.status).toBe(404);
  });

  it("returns 400 for invalid limit", async () => {
    const mockDb = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          all: vi.fn().mockResolvedValue({ results: [] }),
        })),
      })),
    };

    const context = {
      params: { category: "crypto" },
      request: new Request("https://example.com/api/history/crypto?limit=0"),
      locals: { runtime: { env: { DB: mockDb } } },
    } as any;

    const response = await GET(context);
    expect(response.init?.status).toBe(400);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/api/history.test.ts`
Expected: FAIL with "Cannot find module".

**Step 3: Write minimal implementation**

```ts
// src/pages/api/history/[category].ts
import type { APIContext } from "astro";
import { normalizeCategory } from "../../../lib/db/types";
import { getSignalHistory } from "../../../lib/db/client";

const DEFAULT_LIMIT = 7;
const MAX_LIMIT = 30;

export async function GET(context: APIContext) {
  const { category: rawCategory } = context.params;
  const category = normalizeCategory(rawCategory ?? "");

  if (!category) {
    return Response.json(
      { error: "unknown category", valid: ["crypto", "forex", "stocks"] },
      { status: 404 }
    );
  }

  const db = context.locals.runtime?.env?.DB;
  if (!db) {
    return Response.json(
      { error: "database not configured" },
      { status: 500 }
    );
  }

  const url = new URL(context.request.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : DEFAULT_LIMIT;

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return Response.json(
      { error: "invalid limit", min: 1, max: MAX_LIMIT },
      { status: 400 }
    );
  }

  const signals = await getSignalHistory(db, category, limit);

  return Response.json({
    category,
    count: signals.length,
    items: signals.map((s) => ({
      ...s,
      data: s.data_json ? JSON.parse(s.data_json) : null,
      output: s.output_json ? JSON.parse(s.output_json) : null,
    })),
  });
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/api/history.test.ts`
Expected: PASS.

**Step 5: Commit**

Run:
- `git add src/pages/api/history/[category].ts tests/api/history.test.ts`
- `git commit -m "feat: add /api/history/[category] endpoint"`

---

### Task 12: Create `/api/macro` route

**Files:**
- Create: `src/pages/api/macro.ts`
- Test: `tests/api/macro.test.ts`

**Step 1: Write the failing test**

```ts
// tests/api/macro.test.ts
import { describe, it, expect, vi } from "vitest";

class MockResponse {
  body: string;
  init: ResponseInit;
  constructor(body: string, init: ResponseInit = {}) {
    this.body = body;
    this.init = init;
  }
  static json(data: unknown, init?: ResponseInit) {
    return new MockResponse(JSON.stringify(data), init);
  }
}
vi.stubGlobal("Response", MockResponse);

import { GET } from "../../src/pages/api/macro";

describe("GET /api/macro", () => {
  it("returns 500 when DB not configured", async () => {
    const context = {
      locals: { runtime: { env: {} } },
    } as any;

    const response = await GET(context);
    expect(response.init?.status).toBe(500);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/api/macro.test.ts`
Expected: FAIL with "Cannot find module".

**Step 3: Write minimal implementation**

```ts
// src/pages/api/macro.ts
import type { APIContext } from "astro";
import { getLatestMacro } from "../../lib/db/client";

export async function GET(context: APIContext) {
  const db = context.locals.runtime?.env?.DB;
  if (!db) {
    return Response.json(
      { error: "database not configured" },
      { status: 500 }
    );
  }

  const macro = await getLatestMacro(db);
  if (!macro) {
    return Response.json(
      { error: "no macro signal available" },
      { status: 404 }
    );
  }

  return Response.json({
    ...macro,
    data: macro.data_json ? JSON.parse(macro.data_json) : null,
  });
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/api/macro.test.ts`
Expected: PASS.

**Step 5: Commit**

Run:
- `git add src/pages/api/macro.ts tests/api/macro.test.ts`
- `git commit -m "feat: add /api/macro endpoint"`

---

## Phase 4: Signal Generation Worker

### Task 13: Scaffold Worker project

**Files:**
- Create: `worker/package.json`
- Create: `worker/wrangler.toml`
- Create: `worker/src/index.ts`
- Create: `worker/tsconfig.json`

**Step 1: Create worker directory structure**

Run: `mkdir -p worker/src`

**Step 2: Write package.json**

```json
{
  "name": "everinvests-worker",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev --test-scheduled",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20241022.0",
    "typescript": "^5.6.0",
    "wrangler": "^4.59.1"
  }
}
```

**Step 3: Write wrangler.toml**

```toml
# worker/wrangler.toml
name = "everinvests-worker"
main = "src/index.ts"
compatibility_date = "2026-01-14"

[triggers]
crons = ["0 * * * *"]

[[d1_databases]]
binding = "DB"
database_name = "everinvests-db"
database_id = "<YOUR_DATABASE_ID_FROM_TASK_2>"

[ai]
binding = "AI"
```

**Step 4: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src/**/*"]
}
```

**Step 5: Write minimal worker skeleton**

```ts
// worker/src/index.ts
export interface Env {
  DB: D1Database;
  AI: Ai;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  OPENROUTER_API_KEY?: string;
  TWELVEDATA_API_KEY?: string;
  ALPHAVANTAGE_API_KEY?: string;
}

export default {
  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(runScheduledJob(env, event.cron));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/health") {
      return new Response("ok");
    }

    // Manual trigger (for testing)
    if (url.pathname === "/trigger") {
      await runScheduledJob(env, "manual");
      return new Response("triggered");
    }

    return new Response("everinvests-worker", { status: 200 });
  },
};

async function runScheduledJob(env: Env, cron: string): Promise<void> {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

  console.log(`[${cron}] Running at UTC hour ${utcHour}, weekday=${isWeekday}`);

  // TODO: Implement signal generation logic
  // 1. Determine which categories to run based on schedule
  // 2. Fetch macro data (DXY, VIX, 10Y yields)
  // 3. Fetch asset data (Binance for crypto, TwelveData for forex/stocks)
  // 4. Calculate bias using rule engine
  // 5. Generate LLM summary
  // 6. Save to D1
  // 7. Post to Telegram
}
```

**Step 6: Install dependencies**

Run: `cd worker && pnpm install && cd ..`

**Step 7: Commit**

Run:
- `git add worker/`
- `git commit -m "chore: scaffold signal generation worker"`

---

### Task 14: Create worker environment file

**Files:**
- Create: `worker/.dev.vars.example`
- Create: `worker/.gitignore`

**Step 1: Write example env file**

```bash
# worker/.dev.vars.example
# Copy to .dev.vars and fill in values

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=@everinvests

# Data APIs
TWELVEDATA_API_KEY=your_twelvedata_key
ALPHAVANTAGE_API_KEY=your_alphavantage_key

# LLM Fallback (for stocks)
OPENROUTER_API_KEY=your_openrouter_key
```

**Step 2: Write gitignore**

```
# worker/.gitignore
.dev.vars
.wrangler/
node_modules/
```

**Step 3: Commit**

Run:
- `git add worker/.dev.vars.example worker/.gitignore`
- `git commit -m "chore: add worker env template"`

---

## Phase 5: Local Development Workflow

### Task 15: Add development scripts to root package.json

**Files:**
- Modify: `package.json`

**Step 1: Add convenience scripts**

```json
{
  "scripts": {
    "dev": "astro dev",
    "dev:wrangler": "wrangler pages dev dist --d1=DB=everinvests-db",
    "build": "astro build",
    "preview": "astro preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:migrate:local": "wrangler d1 migrations apply everinvests-db --local",
    "db:migrate:remote": "wrangler d1 migrations apply everinvests-db --remote",
    "db:seed": "wrangler d1 execute everinvests-db --local --file=./scripts/seed.sql",
    "worker:dev": "cd worker && pnpm dev",
    "worker:deploy": "cd worker && pnpm deploy",
    "deploy": "pnpm build && wrangler pages deploy dist"
  }
}
```

**Step 2: Commit**

Run:
- `git add package.json`
- `git commit -m "chore: add development convenience scripts"`

---

### Task 16: Create seed data script

**Files:**
- Create: `scripts/seed.sql`

**Step 1: Write seed data**

```sql
-- scripts/seed.sql
-- Sample data for local development

-- Macro signal
INSERT INTO macro_signals (date, time_slot, generated_at, dxy_bias, vix_level, yields_bias, overall)
VALUES
  ('2026-01-14', '08:00', '2026-01-14T08:00:00Z', 'weak', 'risk_on', 'falling', 'Risk-on'),
  ('2026-01-13', '08:00', '2026-01-13T08:00:00Z', 'neutral', 'neutral', 'stable', 'Mixed');

-- Crypto signals
INSERT INTO signals (category, date, time_slot, generated_at, bias, macro_id, output_json)
VALUES
  ('crypto', '2026-01-14', '08:00', '2026-01-14T08:00:05Z', 'Bullish', 1,
   '{"summary":"BTC and ETH holding above 20D MA with healthy funding rates.","levels":{"btc_support":95000,"btc_resistance":100000},"risks":["Elevated funding could trigger squeeze"]}'),
  ('crypto', '2026-01-13', '08:00', '2026-01-13T08:00:05Z', 'Neutral', 2,
   '{"summary":"Consolidation continues with mixed signals.","levels":{"btc_support":92000,"btc_resistance":98000},"risks":["Weekend liquidity thin"]}');

-- Asset signals
INSERT INTO asset_signals (signal_id, ticker, bias, price, vs_20d_ma, secondary_ind)
VALUES
  (1, 'BTC', 'Bullish', 98500, 'above', '0.008'),
  (1, 'ETH', 'Bullish', 3850, 'above', '0.005'),
  (2, 'BTC', 'Neutral', 95200, 'above', '0.015'),
  (2, 'ETH', 'Neutral', 3720, 'below', '0.012');

-- Forex signals
INSERT INTO signals (category, date, time_slot, generated_at, bias, macro_id, output_json)
VALUES
  ('forex', '2026-01-14', '08:00', '2026-01-14T08:00:10Z', 'Bearish', 1,
   '{"summary":"USD weakness continues across major pairs.","risks":["Fed speakers this week"]}');

INSERT INTO asset_signals (signal_id, ticker, bias, price, vs_20d_ma, secondary_ind)
VALUES
  (3, 'USD/JPY', 'Bearish', 148.50, 'below', '42'),
  (3, 'EUR/USD', 'Bullish', 1.0850, 'above', '58');

-- Run log
INSERT INTO run_logs (category, time_slot, run_at, status, duration_ms)
VALUES
  ('crypto', '08:00', '2026-01-14T08:00:05Z', 'success', 2500),
  ('forex', '08:00', '2026-01-14T08:00:10Z', 'success', 3200);
```

**Step 2: Apply seed data**

Run: `pnpm db:seed`
Expected: Data inserted successfully.

**Step 3: Commit**

Run:
- `git add scripts/seed.sql`
- `git commit -m "chore: add local development seed data"`

---

### Task 17: Document local development workflow

**Files:**
- Create: `docs/development.md`

**Step 1: Write documentation**

```markdown
# Local Development Guide

## Prerequisites

- Node.js 20+ (use nvm: `nvm install --lts`)
- pnpm (`corepack enable`)
- Wrangler (`pnpm add -g wrangler`)
- Logged into Cloudflare (`wrangler login`)

## First-Time Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <repo>
   cd everinvests
   pnpm install
   cd worker && pnpm install && cd ..
   ```

2. **Create D1 database (if not exists):**
   ```bash
   wrangler d1 create everinvests-db
   # Copy database_id to wrangler.toml and worker/wrangler.toml
   ```

3. **Apply migrations:**
   ```bash
   pnpm db:migrate:local   # Local D1
   pnpm db:migrate:remote  # Production D1
   ```

4. **Seed local data:**
   ```bash
   pnpm db:seed
   ```

5. **Set up worker secrets (for production):**
   ```bash
   cd worker
   wrangler secret put TELEGRAM_BOT_TOKEN
   wrangler secret put TELEGRAM_CHAT_ID
   wrangler secret put TWELVEDATA_API_KEY
   wrangler secret put ALPHAVANTAGE_API_KEY
   wrangler secret put OPENROUTER_API_KEY
   ```

## Daily Development

### Running the Astro site locally

```bash
# Option 1: Astro dev (fast, no D1)
pnpm dev

# Option 2: Wrangler pages dev (with local D1)
pnpm build && pnpm dev:wrangler
```

### Running the Worker locally

```bash
pnpm worker:dev
# Trigger scheduled job manually:
curl "http://127.0.0.1:8787/__scheduled?cron=0+*+*+*+*"
```

### Testing

```bash
pnpm test           # Run once
pnpm test:watch     # Watch mode
```

## Deployment

### Deploy Astro site (Pages)

```bash
pnpm deploy
# Or use Git integration (push to main)
```

### Deploy Worker

```bash
pnpm worker:deploy
```

### Bind D1 in Dashboard

For Pages: Workers & Pages → everinvests-site → Settings → Functions → D1 bindings → Add `DB`

## Important Notes

1. **Pages local dev cannot connect to remote D1** - this is a Cloudflare limitation. Use Preview deployments to test with real data.

2. **Cron changes take up to 15 minutes to propagate** after deployment.

3. **Workers AI binding** for Pages must be configured in the Cloudflare dashboard, not wrangler.toml.
```

**Step 2: Commit**

Run:
- `git add docs/development.md`
- `git commit -m "docs: add local development guide"`

---

## Remember

- Replace `<YOUR_DATABASE_ID_FROM_TASK_2>` with actual D1 database_id in all wrangler.toml files
- Use `pnpm` consistently throughout
- Exact file paths always
- Complete code in plan (not "add validation")
- Exact commands with expected output
- DRY, YAGNI, TDD, frequent commits

## Execution Handoff

**Plan complete and saved to `docs/plans/2026-01-14-signal-api-foundation.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with @superpowers:executing-plans, batch execution with checkpoints

**Which approach?**

**If Subagent-Driven chosen:**
- **REQUIRED SUB-SKILL:** Use @superpowers:subagent-driven-development
- Stay in this session
- Fresh subagent per task + code review

**If Parallel Session chosen:**
- Guide them to open new session in worktree
- **REQUIRED SUB-SKILL:** New session uses @superpowers:executing-plans
