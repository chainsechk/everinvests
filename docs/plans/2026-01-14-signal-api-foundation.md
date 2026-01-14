# Signal API Foundation Implementation Plan

**Goal:** Build the complete Cloudflare infrastructure (D1 + Workers + Pages) and API endpoints that return the latest and historical signals for crypto/forex/stocks.

**Architecture:**
- **D1:** `everinvests-db` - Shared database for signals and logs
- **Worker:** `everinvests-worker` - Cron Trigger (hourly), signal generation, writes to D1, Telegram notifications
- **Pages (Astro SSR):** `everinvests-site` - SEO pages, read-only D1 access

**Tech Stack:** Astro (SSR), TypeScript, Cloudflare D1 (SQLite), Cloudflare Workers, Workers AI, Vitest (unit tests), Wrangler.

**Cross-Platform Notes:**
- All shell commands assume Git Bash on Windows or native Bash on Linux/macOS
- Use forward slashes in paths
- Node.js scripts used for complex file operations when needed

---

## Progress Tracker

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 1: Infrastructure Setup | Tasks 1-5 | ✅ COMPLETE |
| Phase 2: Database Query Layer | Tasks 6-10 | ⏳ NOT STARTED |
| Phase 3: API Routes | Tasks 11-14 | ⏳ NOT STARTED |
| Phase 4: Signal Generation Worker | Tasks 15-18 | ⏳ NOT STARTED |
| Phase 5: Local Development Workflow | Tasks 19-21 | ⏳ NOT STARTED |

---

## Phase 1: Infrastructure Setup ✅ COMPLETE

### Task 1: Verify existing scaffolding and dependencies ✅

**Files:**
- Read: `package.json`, `astro.config.mjs`, `tsconfig.json`

**Step 1: Confirm Astro + Cloudflare adapter installed**

Run: `cat package.json`
Expected: `@astrojs/cloudflare` and `wrangler` in dependencies.

**Step 2: Verify wrangler is logged in**

Run: `wrangler whoami`
Expected: Shows your Cloudflare account email.

**Step 3: No commit**

Observation-only step.

---

### Task 2: Create D1 database ✅

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

### Task 3: Create D1 migrations ✅

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

### Task 4: Configure wrangler.toml for Pages with D1 binding ✅

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
migrations_dir = "migrations"
```

Replace `<YOUR_DATABASE_ID_FROM_TASK_2>` with the actual database_id from Task 2.

**Step 2: Verify local D1 binding works**

Run: `wrangler d1 execute everinvests-db --local --command "SELECT 1"`
Expected: Returns result showing D1 is accessible.

**Step 3: Commit**

Run:
- `git add wrangler.toml`
- `git commit -m "chore: add wrangler config with D1 binding"`

---

### Task 5: Create environment type definitions ✅

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

### ✅ Phase 1 Checkpoint

Run these commands to verify Phase 1 completion:

```bash
# Verify all files exist
ls -la wrangler.toml migrations/0001_init.sql src/env.d.ts

# Verify D1 database accessible
wrangler d1 list | grep everinvests-db

# Verify TypeScript compiles
npx tsc --noEmit

# Verify tests pass
npm test
```

Expected: All commands succeed with no errors.

---

## Phase 2: Database Query Layer

### Task 6: Create directory structure for Phase 2-3

**Files:**
- Create directories: `src/lib/db`, `tests/db`, `tests/api`

**Step 1: Create all required directories**

```bash
mkdir -p src/lib/db tests/db tests/api
```

**Step 2: Verify directories exist**

```bash
ls -la src/lib/db tests/db tests/api
```

Expected: Empty directories created.

**Step 3: No commit**

Infrastructure step only.

---

### Task 7: Add D1 type definitions

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

Run: `npm test -- tests/db/types.test.ts`
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

Run: `npm test -- tests/db/types.test.ts`
Expected: PASS.

**Step 5: Commit**

Run:
- `git add src/lib/db/types.ts tests/db/types.test.ts`
- `git commit -m "feat: add D1 type definitions and category normalization"`

---

### Task 8: Add SQL query builders

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
    expect(sql).toContain("WHERE s.category = ?");
    expect(sql).toContain("ORDER BY s.date DESC, s.time_slot DESC");
    expect(sql).toContain("LIMIT 1");
  });

  it("historySignalSql selects with limit", () => {
    const sql = historySignalSql();
    expect(sql).toContain("WHERE s.category = ?");
    expect(sql).toContain("LIMIT ?");
  });

  it("assetSignalsSql selects by signal_id", () => {
    const sql = assetSignalsSql();
    expect(sql).toContain("WHERE signal_id = ?");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/db/queries.test.ts`
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

Run: `npm test -- tests/db/queries.test.ts`
Expected: PASS.

**Step 5: Commit**

Run:
- `git add src/lib/db/queries.ts tests/db/queries.test.ts`
- `git commit -m "feat: add SQL query builders for signals"`

---

### Task 9: Add typed database client functions

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

Run: `npm test -- tests/db/client.test.ts`
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

Run: `npm test -- tests/db/client.test.ts`
Expected: PASS.

**Step 5: Commit**

Run:
- `git add src/lib/db/client.ts tests/db/client.test.ts`
- `git commit -m "feat: add typed D1 client functions"`

---

### Task 10: Create db index file

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

### ✅ Phase 2 Checkpoint

Run these commands to verify Phase 2 completion:

```bash
# Verify all db module files exist
ls -la src/lib/db/

# Verify all tests exist
ls -la tests/db/

# Run all db tests
npm test -- tests/db/

# Verify TypeScript compiles
npx tsc --noEmit
```

Expected: All db tests pass, TypeScript compiles without errors.

---

## Phase 3: API Routes

### Task 11: Add API response type definitions

**Files:**
- Create: `src/lib/api/types.ts`

**Step 1: Create API types directory**

```bash
mkdir -p src/lib/api
```

**Step 2: Write API response types**

```ts
// src/lib/api/types.ts
import type { Category } from "../db/types";

export interface AssetResponse {
  id: number;
  signal_id: number;
  ticker: string;
  bias: string | null;
  price: number | null;
  vs_20d_ma: string | null;
  secondary_ind: string | null;
  data: unknown | null;
}

export interface SignalResponse {
  signal: {
    id: number;
    category: Category;
    date: string;
    time_slot: string;
    generated_at: string;
    bias: string;
    macro_id: number | null;
    macro_overall: string | null;
    data: unknown | null;
    output: unknown | null;
  };
  assets: AssetResponse[];
  macro: string | null;
}

export interface HistoryResponse {
  category: Category;
  count: number;
  items: Array<{
    id: number;
    category: Category;
    date: string;
    time_slot: string;
    generated_at: string;
    bias: string;
    macro_overall: string | null;
    data: unknown | null;
    output: unknown | null;
  }>;
}

export interface MacroResponse {
  id: number;
  date: string;
  time_slot: string;
  generated_at: string;
  dxy_bias: string | null;
  vix_level: string | null;
  yields_bias: string | null;
  overall: string | null;
  data: unknown | null;
}

export interface ErrorResponse {
  error: string;
  [key: string]: unknown;
}
```

**Step 3: Create API index file**

```ts
// src/lib/api/index.ts
export * from "./types";
```

**Step 4: Commit**

Run:
- `git add src/lib/api/`
- `git commit -m "feat: add API response type definitions"`

---

### Task 12: Create `/api/today/[category]` route

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

Run: `npm test -- tests/api/today.test.ts`
Expected: FAIL with "Cannot find module".

**Step 3: Create API directory and write implementation**

```bash
mkdir -p src/pages/api/today
```

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

Run: `npm test -- tests/api/today.test.ts`
Expected: PASS.

**Step 5: Commit**

Run:
- `git add src/pages/api/today/[category].ts tests/api/today.test.ts`
- `git commit -m "feat: add /api/today/[category] endpoint"`

---

### Task 13: Create `/api/history/[category]` route

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

Run: `npm test -- tests/api/history.test.ts`
Expected: FAIL with "Cannot find module".

**Step 3: Create directory and write implementation**

```bash
mkdir -p src/pages/api/history
```

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

Run: `npm test -- tests/api/history.test.ts`
Expected: PASS.

**Step 5: Commit**

Run:
- `git add src/pages/api/history/[category].ts tests/api/history.test.ts`
- `git commit -m "feat: add /api/history/[category] endpoint"`

---

### Task 14: Create `/api/macro` route

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

Run: `npm test -- tests/api/macro.test.ts`
Expected: FAIL with "Cannot find module".

**Step 3: Write implementation**

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

Run: `npm test -- tests/api/macro.test.ts`
Expected: PASS.

**Step 5: Commit**

Run:
- `git add src/pages/api/macro.ts tests/api/macro.test.ts`
- `git commit -m "feat: add /api/macro endpoint"`

---

### ✅ Phase 3 Checkpoint

Run these commands to verify Phase 3 completion:

```bash
# Verify all API files exist
ls -la src/pages/api/
ls -la src/pages/api/today/
ls -la src/pages/api/history/

# Verify all API tests exist
ls -la tests/api/

# Run all API tests
npm test -- tests/api/

# Verify TypeScript compiles
npx tsc --noEmit

# Run full test suite
npm test
```

Expected: All tests pass, TypeScript compiles without errors.

---

## Phase 4: Signal Generation Worker

### Task 15: Scaffold Worker project

**Files:**
- Create: `worker/package.json`
- Create: `worker/wrangler.toml`
- Create: `worker/src/index.ts`
- Create: `worker/tsconfig.json`

**Step 1: Create worker directory structure**

```bash
mkdir -p worker/src
```

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

Replace `<YOUR_DATABASE_ID_FROM_TASK_2>` with the actual database_id.

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

```bash
cd worker && npm install && cd ..
```

**Step 7: Commit**

Run:
- `git add worker/`
- `git commit -m "chore: scaffold signal generation worker"`

---

### Task 16: Create worker environment file

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

### Task 17: Add schedule router utility

**Files:**
- Create: `worker/src/schedule.ts`
- Test: `worker/src/schedule.test.ts` (manual verification for now)

**Step 1: Write schedule router**

```ts
// worker/src/schedule.ts
export type Category = "crypto" | "forex" | "stocks";

export interface ScheduleResult {
  categories: Category[];
  timeSlot: string;
}

/**
 * Determines which categories should run based on UTC hour and day of week.
 *
 * Schedule (UTC):
 * - Crypto: 00:00, 08:00, 16:00 (daily)
 * - Forex: 00:00, 08:00, 14:00 (weekdays only)
 * - Stocks: 17:00, 21:00 (weekdays only)
 */
export function getCategoriesToRun(utcHour: number, dayOfWeek: number): ScheduleResult {
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const categories: Category[] = [];

  // Format time slot as HH:00
  const timeSlot = `${utcHour.toString().padStart(2, "0")}:00`;

  // Crypto runs at 00, 08, 16 UTC daily
  if ([0, 8, 16].includes(utcHour)) {
    categories.push("crypto");
  }

  // Forex runs at 00, 08, 14 UTC on weekdays
  if (isWeekday && [0, 8, 14].includes(utcHour)) {
    categories.push("forex");
  }

  // Stocks run at 17, 21 UTC on weekdays
  if (isWeekday && [17, 21].includes(utcHour)) {
    categories.push("stocks");
  }

  return { categories, timeSlot };
}

/**
 * Returns today's date in YYYY-MM-DD format (UTC)
 */
export function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}
```

**Step 2: Verify by inspection**

Review the schedule against CLAUDE.md requirements:
- Crypto: BTC, ETH at 00:00, 08:00, 16:00 ✓
- Forex: USD/JPY, EUR/USD, USD/CAD, USD/AUD at 00:00, 08:00, 14:00 weekdays ✓
- Stocks: 25 tickers at 17:00, 21:00 weekdays ✓

**Step 3: Commit**

Run:
- `git add worker/src/schedule.ts`
- `git commit -m "feat: add schedule router for cron triggers"`

---

### Task 18: Add database write utilities for Worker

**Files:**
- Create: `worker/src/db.ts`

**Step 1: Write database utilities**

```ts
// worker/src/db.ts
import type { Category } from "./schedule";

export interface MacroData {
  dxy_bias: string | null;
  vix_level: string | null;
  yields_bias: string | null;
  overall: string;
  data_json?: string;
}

export interface SignalData {
  category: Category;
  bias: string;
  macro_id: number | null;
  data_json?: string;
  output_json?: string;
}

export interface AssetData {
  ticker: string;
  bias: string | null;
  price: number | null;
  vs_20d_ma: string | null;
  secondary_ind: string | null;
  data_json?: string;
}

export async function insertMacroSignal(
  db: D1Database,
  date: string,
  timeSlot: string,
  data: MacroData
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO macro_signals (date, time_slot, generated_at, dxy_bias, vix_level, yields_bias, overall, data_json)
       VALUES (?, ?, datetime('now'), ?, ?, ?, ?, ?)
       ON CONFLICT(date, time_slot) DO UPDATE SET
         generated_at = datetime('now'),
         dxy_bias = excluded.dxy_bias,
         vix_level = excluded.vix_level,
         yields_bias = excluded.yields_bias,
         overall = excluded.overall,
         data_json = excluded.data_json
       RETURNING id`
    )
    .bind(
      date,
      timeSlot,
      data.dxy_bias,
      data.vix_level,
      data.yields_bias,
      data.overall,
      data.data_json ?? null
    )
    .first<{ id: number }>();

  return result?.id ?? 0;
}

export async function insertSignal(
  db: D1Database,
  date: string,
  timeSlot: string,
  data: SignalData
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO signals (category, date, time_slot, generated_at, bias, macro_id, data_json, output_json)
       VALUES (?, ?, ?, datetime('now'), ?, ?, ?, ?)
       ON CONFLICT(category, date, time_slot) DO UPDATE SET
         generated_at = datetime('now'),
         bias = excluded.bias,
         macro_id = excluded.macro_id,
         data_json = excluded.data_json,
         output_json = excluded.output_json
       RETURNING id`
    )
    .bind(
      data.category,
      date,
      timeSlot,
      data.bias,
      data.macro_id,
      data.data_json ?? null,
      data.output_json ?? null
    )
    .first<{ id: number }>();

  return result?.id ?? 0;
}

export async function insertAssetSignals(
  db: D1Database,
  signalId: number,
  assets: AssetData[]
): Promise<void> {
  // Delete existing assets for this signal
  await db
    .prepare("DELETE FROM asset_signals WHERE signal_id = ?")
    .bind(signalId)
    .run();

  // Insert new assets
  for (const asset of assets) {
    await db
      .prepare(
        `INSERT INTO asset_signals (signal_id, ticker, bias, price, vs_20d_ma, secondary_ind, data_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        signalId,
        asset.ticker,
        asset.bias,
        asset.price,
        asset.vs_20d_ma,
        asset.secondary_ind,
        asset.data_json ?? null
      )
      .run();
  }
}

export async function insertRunLog(
  db: D1Database,
  category: Category | null,
  timeSlot: string,
  status: "success" | "error",
  durationMs: number,
  errorMsg?: string
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO run_logs (category, time_slot, run_at, status, duration_ms, error_msg)
       VALUES (?, ?, datetime('now'), ?, ?, ?)`
    )
    .bind(category, timeSlot, status, durationMs, errorMsg ?? null)
    .run();
}
```

**Step 2: Commit**

Run:
- `git add worker/src/db.ts`
- `git commit -m "feat: add database write utilities for worker"`

---

### ✅ Phase 4 Checkpoint

Run these commands to verify Phase 4 completion:

```bash
# Verify worker files exist
ls -la worker/
ls -la worker/src/

# Verify worker compiles
cd worker && npx tsc --noEmit && cd ..

# Test worker locally (optional)
cd worker && npm run dev &
curl http://localhost:8787/health
# Should return: ok
```

Expected: Worker compiles, health check returns "ok".

---

## Phase 5: Local Development Workflow

### Task 19: Add development scripts to root package.json

**Files:**
- Modify: `package.json`

**Step 1: Update package.json with convenience scripts**

Replace the scripts section in `package.json` with:

```json
{
  "scripts": {
    "dev": "astro dev",
    "dev:wrangler": "astro build && wrangler pages dev dist --d1=DB=everinvests-db",
    "build": "astro build",
    "preview": "astro preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "db:migrate:local": "wrangler d1 migrations apply everinvests-db --local",
    "db:migrate:remote": "wrangler d1 migrations apply everinvests-db --remote",
    "db:seed": "wrangler d1 execute everinvests-db --local --file=./scripts/seed.sql",
    "worker:dev": "cd worker && npm run dev",
    "worker:deploy": "cd worker && npm run deploy",
    "deploy": "npm run build && wrangler pages deploy dist"
  }
}
```

**Step 2: Commit**

Run:
- `git add package.json`
- `git commit -m "chore: add development convenience scripts"`

---

### Task 20: Create seed data script

**Files:**
- Create: `scripts/seed.sql`

**Step 1: Create scripts directory**

```bash
mkdir -p scripts
```

**Step 2: Write seed data**

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

**Step 3: Apply seed data (verify locally)**

Run: `npm run db:seed`
Expected: Data inserted successfully.

**Step 4: Commit**

Run:
- `git add scripts/seed.sql`
- `git commit -m "chore: add local development seed data"`

---

### Task 21: Document local development workflow

**Files:**
- Create: `docs/development.md`

**Step 1: Write documentation**

```markdown
# Local Development Guide

## Prerequisites

- Node.js 20+ (use nvm: `nvm install --lts`)
- npm (comes with Node.js)
- Wrangler (`npm install -g wrangler`)
- Logged into Cloudflare (`wrangler login`)

## First-Time Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <repo>
   cd everinvests
   npm install
   cd worker && npm install && cd ..
   ```

2. **Create D1 database (if not exists):**
   ```bash
   wrangler d1 create everinvests-db
   # Copy database_id to wrangler.toml and worker/wrangler.toml
   ```

3. **Apply migrations:**
   ```bash
   npm run db:migrate:local   # Local D1
   npm run db:migrate:remote  # Production D1
   ```

4. **Seed local data:**
   ```bash
   npm run db:seed
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
npm run dev

# Option 2: Wrangler pages dev (with local D1)
npm run dev:wrangler
```

### Running the Worker locally

```bash
npm run worker:dev
# Trigger scheduled job manually:
curl "http://127.0.0.1:8787/__scheduled?cron=0+*+*+*+*"
```

### Testing

```bash
npm test           # Run once
npm run test:watch # Watch mode
npm run typecheck  # TypeScript check
```

## Deployment

### Deploy Astro site (Pages)

```bash
npm run deploy
# Or use Git integration (push to main)
```

### Deploy Worker

```bash
npm run worker:deploy
```

### Bind D1 in Dashboard

For Pages: Workers & Pages → everinvests-site → Settings → Functions → D1 bindings → Add `DB`

## Important Notes

1. **Pages local dev cannot connect to remote D1** - this is a Cloudflare limitation. Use Preview deployments to test with real data.

2. **Cron changes take up to 15 minutes to propagate** after deployment.

3. **Workers AI binding** for Pages must be configured in the Cloudflare dashboard, not wrangler.toml.

## Troubleshooting

### TypeScript errors after pulling changes
```bash
npm run typecheck
```

### D1 migration issues
```bash
# Check current migration state
wrangler d1 migrations list everinvests-db --local

# Reset local D1 (destructive!)
rm -rf .wrangler/state
npm run db:migrate:local
npm run db:seed
```

### Worker not triggering cron
- Verify deployment: `cd worker && wrangler deployments list`
- Check logs: `cd worker && wrangler tail`
```

**Step 2: Commit**

Run:
- `git add docs/development.md`
- `git commit -m "docs: add local development guide"`

---

### ✅ Phase 5 Checkpoint (Final)

Run these commands to verify Phase 5 and full project completion:

```bash
# Verify all scripts work
npm run typecheck
npm test

# Verify documentation exists
cat docs/development.md

# Verify seed data exists
cat scripts/seed.sql

# Full integration test (requires local D1)
npm run db:migrate:local
npm run db:seed
npm run dev:wrangler &
curl http://localhost:8788/api/today/crypto
curl http://localhost:8788/api/history/crypto?limit=5
curl http://localhost:8788/api/macro
```

Expected: All endpoints return valid JSON responses with seeded data.

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| Phase 1 | 1-5 | Infrastructure: D1 database, migrations, wrangler config, types |
| Phase 2 | 6-10 | Database layer: types, queries, client functions |
| Phase 3 | 11-14 | API routes: /api/today, /api/history, /api/macro |
| Phase 4 | 15-18 | Worker: scaffold, env, schedule router, DB utilities |
| Phase 5 | 19-21 | DevEx: scripts, seed data, documentation |

**Total: 21 tasks**

---

## Next Steps

Resume execution from **Task 6** (create directory structure). All Phase 1 infrastructure is complete.
