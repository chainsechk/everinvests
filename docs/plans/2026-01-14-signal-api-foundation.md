# Signal API Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use @superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build API endpoints that return the latest and historical signals for crypto/forex/stocks from Cloudflare D1.

**Architecture:** Astro API routes (`src/pages/api/...`) call a tiny, shared query layer (`src/lib/db/...`) that wraps D1 access and returns typed objects. Validation is minimal and focused: only category/time-slot inputs are normalized to known values to keep output consistent and avoid garbage-in. Tests run at the query layer (for SQL correctness) and at the route layer (for response shape).

**Tech Stack:** Astro (SSR), TypeScript, Cloudflare D1 (SQLite), Vitest (unit tests), Wrangler (local D1).

---

### Task 1: Orientation + verify scaffolding

**Files:**
- Read: `CLAUDE.md`
- Read: `design.md`
- Inspect: `package.json` (if it exists)
- Inspect: `src/pages/api/` (if it exists)

**Step 1: Read project docs**

Run: `cat CLAUDE.md design.md`
Expected: You understand the signal categories, schedules, and API shape.

**Step 2: Check whether Astro project exists**

Run: `ls` and `ls src/pages` (if `src` exists)
Expected: Either an existing Astro structure or an empty repo that needs scaffolding.

**Step 3: Commit (docs-only observation)**

No commit for observation-only steps.

---

### Task 2: Scaffold minimal Astro + test harness (skip if already present)

**Files:**
- Create: `package.json`
- Create: `astro.config.mjs`
- Create: `tsconfig.json`
- Create: `src/pages/index.astro`
- Create: `vitest.config.ts`
- Create: `tests/.gitkeep`

**Step 1: Write the failing test**

Create a minimal smoke test to assert the test runner executes.

```ts
import { describe, it, expect } from "vitest";

describe("test harness", () => {
  it("runs", () => {
    expect(true).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with "command not found" (no scripts yet).

**Step 3: Write minimal implementation**

Add `package.json` scripts and minimal Astro/Vitest config.

```json
{
  "name": "everinvests",
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "test": "vitest run"
  },
  "devDependencies": {
    "astro": "^4.0.0",
    "vitest": "^1.5.0",
    "typescript": "^5.0.0"
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm install` then `npm test`
Expected: PASS with 1 test.

**Step 5: Commit**

Run:
- `git add package.json astro.config.mjs tsconfig.json vitest.config.ts src/pages/index.astro tests`
- `git commit -m "chore: scaffold astro app and tests"`

---

### Task 3: Add D1 query layer for signals

**Files:**
- Create: `src/lib/db/client.ts`
- Create: `src/lib/db/queries.ts`
- Create: `src/lib/db/types.ts`
- Test: `tests/db/queries.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { latestSignalSql } from "../../src/lib/db/queries";

describe("latestSignalSql", () => {
  it("selects latest by category", () => {
    const sql = latestSignalSql("crypto");
    expect(sql).toContain("WHERE category = ?");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/db/queries.test.ts`
Expected: FAIL with "module not found" for `queries`.

**Step 3: Write minimal implementation**

```ts
// src/lib/db/queries.ts
export const latestSignalSql = (category: string) =>
  `SELECT * FROM signals WHERE category = ? ORDER BY date DESC, time_slot DESC LIMIT 1`;
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/db/queries.test.ts`
Expected: PASS.

**Step 5: Commit**

Run:
- `git add src/lib/db/queries.ts tests/db/queries.test.ts`
- `git commit -m "feat: add base sql for latest signal"`

---

### Task 4: Implement typed query helpers for latest + history

**Files:**
- Modify: `src/lib/db/queries.ts`
- Modify: `src/lib/db/types.ts`
- Modify: `src/lib/db/client.ts`
- Test: `tests/db/client.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { getLatestSignal } from "../../src/lib/db/client";

describe("getLatestSignal", () => {
  it("returns null when no rows", async () => {
    const db = { prepare: vi.fn(() => ({ bind: () => ({ first: async () => null }) })) } as any;
    const result = await getLatestSignal(db, "crypto");
    expect(result).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/db/client.test.ts`
Expected: FAIL with "getLatestSignal is not a function".

**Step 3: Write minimal implementation**

```ts
// src/lib/db/types.ts
export type Category = "crypto" | "forex" | "stocks";

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
```

```ts
// src/lib/db/client.ts
import type { Category, SignalRow } from "./types";
import { latestSignalSql } from "./queries";

export async function getLatestSignal(db: D1Database, category: Category): Promise<SignalRow | null> {
  const row = await db.prepare(latestSignalSql(category)).bind(category).first<SignalRow>();
  return row ?? null;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/db/client.test.ts`
Expected: PASS.

**Step 5: Commit**

Run:
- `git add src/lib/db/client.ts src/lib/db/types.ts tests/db/client.test.ts`
- `git commit -m "feat: add db client helpers for latest signal"`

---

### Task 5: Add history query helper + tests

**Files:**
- Modify: `src/lib/db/queries.ts`
- Modify: `src/lib/db/client.ts`
- Test: `tests/db/history.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { getSignalHistory } from "../../src/lib/db/client";

describe("getSignalHistory", () => {
  it("returns an empty array when no rows", async () => {
    const db = { prepare: vi.fn(() => ({ bind: () => ({ all: async () => ({ results: [] }) }) })) } as any;
    const result = await getSignalHistory(db, "crypto", 7);
    expect(result).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/db/history.test.ts`
Expected: FAIL with "getSignalHistory is not a function".

**Step 3: Write minimal implementation**

```ts
// src/lib/db/queries.ts
export const historySignalSql = (category: string) =>
  `SELECT * FROM signals WHERE category = ? ORDER BY date DESC, time_slot DESC LIMIT ?`;
```

```ts
// src/lib/db/client.ts
import { historySignalSql } from "./queries";

export async function getSignalHistory(db: D1Database, category: Category, limit: number): Promise<SignalRow[]> {
  const { results } = await db.prepare(historySignalSql(category)).bind(category, limit).all<SignalRow>();
  return results ?? [];
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/db/history.test.ts`
Expected: PASS.

**Step 5: Commit**

Run:
- `git add src/lib/db/queries.ts src/lib/db/client.ts tests/db/history.test.ts`
- `git commit -m "feat: add db helper for signal history"`

---

### Task 6: Create API route for latest signal

**Files:**
- Create: `src/pages/api/today/[category].ts`
- Modify: `src/lib/db/types.ts`
- Test: `tests/api/today.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { normalizeCategory } from "../../src/lib/db/types";

describe("normalizeCategory", () => {
  it("returns null for unknown", () => {
    expect(normalizeCategory("metals")).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/api/today.test.ts`
Expected: FAIL with "normalizeCategory is not a function".

**Step 3: Write minimal implementation**

```ts
// src/lib/db/types.ts
export const categories = ["crypto", "forex", "stocks"] as const;
export type Category = (typeof categories)[number];

export function normalizeCategory(value: string): Category | null {
  return categories.includes(value as Category) ? (value as Category) : null;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/api/today.test.ts`
Expected: PASS.

**Step 5: Commit**

Run:
- `git add src/lib/db/types.ts tests/api/today.test.ts`
- `git commit -m "feat: add category normalization"`

---

### Task 7: Implement `/api/today/[category]` route

**Files:**
- Modify: `src/pages/api/today/[category].ts`
- Test: `tests/api/today-route.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { GET } from "../../src/pages/api/today/[category]";

vi.stubGlobal("Response", class {
  constructor(public body: string, public init: ResponseInit) {}
  static json(data: unknown, init?: ResponseInit) {
    return new Response(JSON.stringify(data), init);
  }
});

describe("GET /api/today/[category]", () => {
  it("returns 404 for invalid category", async () => {
    const response = await GET({ params: { category: "metals" }, locals: {} } as any);
    expect(response.init.status).toBe(404);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/api/today-route.test.ts`
Expected: FAIL with "GET is not a function".

**Step 3: Write minimal implementation**

```ts
// src/pages/api/today/[category].ts
import { normalizeCategory } from "../../../lib/db/types";
import { getLatestSignal } from "../../../lib/db/client";

export async function GET({ params, locals }: { params: { category: string }; locals: { db?: D1Database } }) {
  const category = normalizeCategory(params.category);
  if (!category) {
    return Response.json({ error: "unknown category" }, { status: 404 });
  }

  if (!locals.db) {
    return Response.json({ error: "database not configured" }, { status: 500 });
  }

  const signal = await getLatestSignal(locals.db, category);
  if (!signal) {
    return Response.json({ error: "no signal" }, { status: 404 });
  }

  return Response.json(signal, { status: 200 });
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/api/today-route.test.ts`
Expected: PASS.

**Step 5: Commit**

Run:
- `git add src/pages/api/today/[category].ts tests/api/today-route.test.ts`
- `git commit -m "feat: add today signal api route"`

---

### Task 8: Implement `/api/history/[category]` route

**Files:**
- Create: `src/pages/api/history/[category].ts`
- Test: `tests/api/history-route.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, it, expect, vi } from "vitest";
import { GET } from "../../src/pages/api/history/[category]";

vi.stubGlobal("Response", class {
  constructor(public body: string, public init: ResponseInit) {}
  static json(data: unknown, init?: ResponseInit) {
    return new Response(JSON.stringify(data), init);
  }
});

describe("GET /api/history/[category]", () => {
  it("returns 400 when limit is invalid", async () => {
    const response = await GET({ params: { category: "crypto" }, request: new Request("https://x?limit=0"), locals: {} } as any);
    expect(response.init.status).toBe(400);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/api/history-route.test.ts`
Expected: FAIL with "GET is not a function".

**Step 3: Write minimal implementation**

```ts
// src/pages/api/history/[category].ts
import { normalizeCategory } from "../../../lib/db/types";
import { getSignalHistory } from "../../../lib/db/client";

const DEFAULT_LIMIT = 7;
const MAX_LIMIT = 30;

export async function GET({ params, request, locals }: { params: { category: string }; request: Request; locals: { db?: D1Database } }) {
  const category = normalizeCategory(params.category);
  if (!category) {
    return Response.json({ error: "unknown category" }, { status: 404 });
  }

  if (!locals.db) {
    return Response.json({ error: "database not configured" }, { status: 500 });
  }

  const url = new URL(request.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return Response.json({ error: "invalid limit" }, { status: 400 });
  }

  const history = await getSignalHistory(locals.db, category, limit);
  return Response.json({ items: history }, { status: 200 });
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/api/history-route.test.ts`
Expected: PASS.

**Step 5: Commit**

Run:
- `git add src/pages/api/history/[category].ts tests/api/history-route.test.ts`
- `git commit -m "feat: add history signal api route"`

---

### Task 9: Document local testing + D1 setup

**Files:**
- Create: `docs/api.md`
- Modify: `README.md` (create if missing)

**Step 1: Write the failing test**

Not required for docs-only changes.

**Step 2: Run test to verify it fails**

Skip (docs-only).

**Step 3: Write minimal implementation**

Document:
- how to run `wrangler d1` locally
- how to bind `locals.db` (Astro adapter config)
- example curl calls for `/api/today/crypto` and `/api/history/crypto?limit=7`

**Step 4: Run test to verify it passes**

Skip (docs-only).

**Step 5: Commit**

Run:
- `git add docs/api.md README.md`
- `git commit -m "docs: add api testing and d1 setup notes"`

---

## Remember
- Exact file paths always
- Complete code in plan (not "add validation")
- Exact commands with expected output
- Reference relevant skills with @ syntax
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
