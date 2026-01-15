# Frontend UI Implementation Plan

**Date:** 2026-01-15
**Status:** Ready
**Prerequisite:** Phases 1-7 complete (backend infrastructure)

---

## Executive Summary

The backend is production-ready with API endpoints, database, and signal generation worker. This plan covers building the frontend UI that consumes those APIs and presents signals to users.

**Goal:** Build a complete, SEO-friendly frontend that displays market signals and funnels users to Telegram.

**Approach:** Component-first development with Tailwind CSS, building shared components first then composing into pages.

---

## Architecture Overview

```
src/
├── layouts/
│   └── BaseLayout.astro         # HTML wrapper, meta, scripts
├── components/
│   ├── Header.astro             # Navigation bar
│   ├── Footer.astro             # Footer links
│   ├── MacroBar.astro           # Risk-on/off indicator
│   ├── SignalCard.astro         # Category card (home)
│   ├── TelegramCTA.astro        # Telegram call-to-action
│   ├── BiasIndicator.astro      # Bullish/Neutral/Bearish
│   ├── SignalDetail.astro       # Full signal display
│   ├── AssetTable.astro         # Per-asset breakdown
│   ├── HistoryMini.astro        # Last 7 days mini-cards
│   └── HistoryList.astro        # Full archive list
└── pages/
    ├── index.astro              # Home (overview)
    ├── about.astro              # Methodology + CTA
    ├── crypto/
    │   ├── index.astro          # Today's crypto signal
    │   └── history.astro        # Crypto archive
    ├── forex/
    │   ├── index.astro          # Today's forex signal
    │   └── history.astro        # Forex archive
    └── stocks/
        ├── index.astro          # Today's stocks signal
        └── history.astro        # Stocks archive
```

---

## Progress Tracker

| Phase | Tasks | Status |
|-------|-------|--------|
| Phase 8: Styling + Layout | Tasks 1-4 | pending |
| Phase 9: Home Page | Tasks 5-8 | pending |
| Phase 10: Category Pages | Tasks 9-14 | pending |
| Phase 11: History Pages | Tasks 15-17 | pending |
| Phase 12: About Page | Task 18 | pending |
| Phase 13: Production Deploy | Tasks 19-21 | pending |
| Phase 14: SEO & Polish | Tasks 22-24 | pending |

---

## Phase 8: Styling Foundation + Layout

### Task 1: Add Tailwind CSS

**Files:**
- Modify: `package.json`
- Create: `src/styles/global.css`
- Modify: `astro.config.mjs`

**Step 1: Install Tailwind and dependencies**

```bash
npm install -D tailwindcss @astrojs/tailwind
npx tailwindcss init
```

**Step 2: Configure Astro integration**

Update `astro.config.mjs`:

```js
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import tailwind from "@astrojs/tailwind";

export default defineConfig({
  output: "server",
  adapter: cloudflare({
    platformProxy: { enabled: true },
  }),
  integrations: [tailwind()],
});
```

**Step 3: Configure Tailwind**

Update `tailwind.config.mjs`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        bullish: "#22c55e",    // green-500
        bearish: "#ef4444",    // red-500
        neutral: "#6b7280",    // gray-500
        riskon: "#22c55e",     // green-500
        riskoff: "#ef4444",    // red-500
        mixed: "#f59e0b",      // amber-500
      },
    },
  },
  plugins: [],
};
```

**Step 4: Create global styles**

```css
/* src/styles/global.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply bg-gray-900 text-gray-100 antialiased;
  }
}

@layer components {
  .card {
    @apply bg-gray-800 rounded-lg border border-gray-700 p-4;
  }
  .btn-primary {
    @apply bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors;
  }
  .btn-telegram {
    @apply bg-sky-500 hover:bg-sky-600 text-white font-medium px-4 py-2 rounded-lg transition-colors;
  }
}
```

**Step 5: Commit**

```
git add -A && git commit -m "chore: add Tailwind CSS configuration"
```

---

### Task 2: Create BaseLayout component

**Files:**
- Create: `src/layouts/BaseLayout.astro`

**Step 1: Write BaseLayout**

```astro
---
// src/layouts/BaseLayout.astro
interface Props {
  title: string;
  description?: string;
}

const { title, description = "Daily market signals for Crypto, Forex, and Stocks" } = Astro.props;
const fullTitle = title === "EverInvests" ? title : `${title} | EverInvests`;
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content={description} />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>{fullTitle}</title>
  </head>
  <body class="min-h-screen flex flex-col">
    <slot name="header" />
    <main class="flex-grow container mx-auto px-4 py-6">
      <slot />
    </main>
    <slot name="footer" />
  </body>
</html>
```

**Step 2: Commit**

```
git add src/layouts/BaseLayout.astro && git commit -m "feat: add BaseLayout component"
```

---

### Task 3: Create Header component

**Files:**
- Create: `src/components/Header.astro`

**Step 1: Write Header**

```astro
---
// src/components/Header.astro
const pathname = Astro.url.pathname;

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/crypto", label: "Crypto" },
  { href: "/forex", label: "Forex" },
  { href: "/stocks", label: "Stocks" },
  { href: "/about", label: "About" },
];

function isActive(href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}
---

<header class="bg-gray-800 border-b border-gray-700">
  <div class="container mx-auto px-4">
    <nav class="flex items-center justify-between h-16">
      <a href="/" class="text-xl font-bold text-white">
        EverInvests
      </a>
      <ul class="flex items-center gap-1 sm:gap-2">
        {navLinks.map((link) => (
          <li>
            <a
              href={link.href}
              class:list={[
                "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive(link.href)
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-700/50",
              ]}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  </div>
</header>
```

**Step 2: Commit**

```
git add src/components/Header.astro && git commit -m "feat: add Header component"
```

---

### Task 4: Create Footer component

**Files:**
- Create: `src/components/Footer.astro`

**Step 1: Write Footer**

```astro
---
// src/components/Footer.astro
const year = new Date().getFullYear();
---

<footer class="bg-gray-800 border-t border-gray-700 py-6">
  <div class="container mx-auto px-4">
    <div class="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
      <p>&copy; {year} EverInvests. Market signals for educational purposes only.</p>
      <div class="flex items-center gap-4">
        <a href="/about" class="hover:text-white transition-colors">About</a>
        <a href="https://t.me/everinvests" target="_blank" rel="noopener" class="hover:text-white transition-colors">
          Telegram
        </a>
      </div>
    </div>
  </div>
</footer>
```

**Step 2: Commit**

```
git add src/components/Footer.astro && git commit -m "feat: add Footer component"
```

---

### Phase 8 Checkpoint

```bash
# Verify all files exist
ls -la src/layouts/ src/components/

# Verify build works
npm run build

# Run dev server and verify styling
npm run dev
```

Expected: Tailwind compiles, layout components render correctly.

---

## Phase 9: Home Page

### Task 5: Create MacroBar component

**Files:**
- Create: `src/components/MacroBar.astro`

**Step 1: Write MacroBar**

```astro
---
// src/components/MacroBar.astro
interface Props {
  overall: string | null;
  dxyBias: string | null;
  vixLevel: string | null;
  yieldsBias: string | null;
}

const { overall, dxyBias, vixLevel, yieldsBias } = Astro.props;

function getOverallColor(value: string | null): string {
  if (!value) return "text-gray-400";
  const lower = value.toLowerCase();
  if (lower.includes("risk-on")) return "text-riskon";
  if (lower.includes("risk-off")) return "text-riskoff";
  return "text-mixed";
}

function getOverallEmoji(value: string | null): string {
  if (!value) return "";
  const lower = value.toLowerCase();
  if (lower.includes("risk-on")) return "";
  if (lower.includes("risk-off")) return "";
  return "";
}

function formatDxy(bias: string | null): string {
  if (!bias) return "DXY: --";
  return `DXY ${bias}`;
}

function formatVix(level: string | null): string {
  if (!level) return "VIX: --";
  const lower = level.toLowerCase();
  if (lower === "risk_on") return "VIX low";
  if (lower === "risk_off") return "VIX high";
  return "VIX neutral";
}

function formatYields(bias: string | null): string {
  if (!bias) return "Yields: --";
  if (bias === "falling") return "Yields falling";
  if (bias === "rising") return "Yields rising";
  return "Yields stable";
}
---

<div class="card flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-sm">
  <div class="flex items-center gap-2">
    <span class="text-gray-400">MACRO:</span>
    <span class:list={["font-semibold", getOverallColor(overall)]}>
      {overall || "Loading..."} {getOverallEmoji(overall)}
    </span>
  </div>
  <div class="hidden sm:block w-px h-4 bg-gray-600"></div>
  <span class="text-gray-300">{formatDxy(dxyBias)}</span>
  <span class="text-gray-300">{formatVix(vixLevel)}</span>
  <span class="text-gray-300">{formatYields(yieldsBias)}</span>
</div>
```

**Step 2: Commit**

```
git add src/components/MacroBar.astro && git commit -m "feat: add MacroBar component"
```

---

### Task 6: Create SignalCard component

**Files:**
- Create: `src/components/SignalCard.astro`

**Step 1: Write SignalCard**

```astro
---
// src/components/SignalCard.astro
interface Props {
  category: "crypto" | "forex" | "stocks";
  bias: string | null;
  summary: string | null;
  assetCount: number;
  updatedAt: string | null;
}

const { category, bias, summary, assetCount, updatedAt } = Astro.props;

const categoryLabels: Record<string, string> = {
  crypto: "CRYPTO",
  forex: "FOREX",
  stocks: "STOCKS",
};

const categoryDescriptions: Record<string, string> = {
  crypto: "BTC, ETH",
  forex: "4 major pairs",
  stocks: "25 tickers",
};

function getBiasColor(bias: string | null): string {
  if (!bias) return "text-gray-400";
  const lower = bias.toLowerCase();
  if (lower.includes("bullish")) return "text-bullish";
  if (lower.includes("bearish")) return "text-bearish";
  return "text-neutral";
}

function getBiasArrow(bias: string | null): string {
  if (!bias) return "";
  const lower = bias.toLowerCase();
  if (lower.includes("bullish")) return " ^";
  if (lower.includes("bearish")) return " v";
  return " -";
}

function formatTime(isoString: string | null): string {
  if (!isoString) return "--:--";
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
  } catch {
    return "--:--";
  }
}
---

<a href={`/${category}`} class="card hover:border-gray-500 transition-colors group block">
  <div class="flex flex-col h-full">
    <div class="text-xs text-gray-400 font-medium mb-2">{categoryLabels[category]}</div>

    <div class:list={["text-2xl font-bold mb-3", getBiasColor(bias)]}>
      {bias || "No signal"}{getBiasArrow(bias)}
    </div>

    <p class="text-sm text-gray-300 mb-4 flex-grow line-clamp-3">
      {summary || `${categoryDescriptions[category]} - awaiting signal`}
    </p>

    <div class="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-700">
      <span>{categoryDescriptions[category]}</span>
      <span>{formatTime(updatedAt)}</span>
    </div>

    <div class="mt-3 text-sm text-blue-400 group-hover:text-blue-300 transition-colors">
      View details &rarr;
    </div>
  </div>
</a>
```

**Step 2: Commit**

```
git add src/components/SignalCard.astro && git commit -m "feat: add SignalCard component"
```

---

### Task 7: Create TelegramCTA component

**Files:**
- Create: `src/components/TelegramCTA.astro`

**Step 1: Write TelegramCTA**

```astro
---
// src/components/TelegramCTA.astro
interface Props {
  variant?: "full" | "compact";
}

const { variant = "full" } = Astro.props;

const freeChannelUrl = "https://t.me/everinvests";
const premiumUrl = "https://t.me/everinvests_premium";
---

{variant === "full" ? (
  <div class="card bg-gradient-to-r from-gray-800 to-gray-800/50 border-sky-500/30">
    <div class="flex flex-col sm:flex-row items-center gap-6">
      <div class="flex-shrink-0 text-4xl">
        <svg class="w-12 h-12 text-sky-400" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.242-1.865-.442-.751-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635.099-.002.321.023.465.141.12.098.153.228.166.331.014.103.03.318.017.492z"/>
        </svg>
      </div>
      <div class="flex-grow text-center sm:text-left">
        <h3 class="text-lg font-semibold text-white mb-1">Join Telegram</h3>
        <p class="text-sm text-gray-400 mb-3">
          Get real-time notifications when signals update. Premium members get hedge-fund-grade analysis.
        </p>
        <div class="flex flex-wrap justify-center sm:justify-start gap-3">
          <a href={freeChannelUrl} target="_blank" rel="noopener" class="btn-telegram">
            Join Free Channel
          </a>
          <a href={premiumUrl} target="_blank" rel="noopener" class="btn-primary">
            Explore Premium
          </a>
        </div>
      </div>
    </div>
  </div>
) : (
  <a href={freeChannelUrl} target="_blank" rel="noopener" class="btn-telegram inline-flex items-center gap-2">
    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.242-1.865-.442-.751-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635.099-.002.321.023.465.141.12.098.153.228.166.331.014.103.03.318.017.492z"/>
    </svg>
    Join Telegram
  </a>
)}
```

**Step 2: Commit**

```
git add src/components/TelegramCTA.astro && git commit -m "feat: add TelegramCTA component"
```

---

### Task 8: Wire up Home page

**Files:**
- Modify: `src/pages/index.astro`

**Step 1: Implement Home page**

```astro
---
// src/pages/index.astro
import BaseLayout from "../layouts/BaseLayout.astro";
import Header from "../components/Header.astro";
import Footer from "../components/Footer.astro";
import MacroBar from "../components/MacroBar.astro";
import SignalCard from "../components/SignalCard.astro";
import TelegramCTA from "../components/TelegramCTA.astro";
import { getLatestMacro, getLatestSignal, getAssetSignals } from "../lib/db";

const db = Astro.locals.runtime?.env?.DB;

let macro = null;
let cryptoSignal = null;
let forexSignal = null;
let stocksSignal = null;

if (db) {
  [macro, cryptoSignal, forexSignal, stocksSignal] = await Promise.all([
    getLatestMacro(db),
    getLatestSignal(db, "crypto"),
    getLatestSignal(db, "forex"),
    getLatestSignal(db, "stocks"),
  ]);
}

function extractSummary(signal: any): string | null {
  if (!signal?.output_json) return null;
  try {
    const output = JSON.parse(signal.output_json);
    return output.summary || null;
  } catch {
    return null;
  }
}

async function getAssetCount(signal: any): Promise<number> {
  if (!signal || !db) return 0;
  const assets = await getAssetSignals(db, signal.id);
  return assets.length;
}

const cryptoAssetCount = await getAssetCount(cryptoSignal);
const forexAssetCount = await getAssetCount(forexSignal);
const stocksAssetCount = await getAssetCount(stocksSignal);

function formatNextUpdate(): string {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const schedules = [0, 8, 14, 16, 17, 21];
  const nextHour = schedules.find((h) => h > utcHour) || schedules[0];
  return `${nextHour.toString().padStart(2, "0")}:00 UTC`;
}
---

<BaseLayout title="EverInvests" description="Daily market signals for Crypto, Forex, and Stocks. Free automated analysis updated multiple times daily.">
  <Header slot="header" />

  <div class="space-y-8">
    <!-- Macro Context -->
    <MacroBar
      overall={macro?.overall}
      dxyBias={macro?.dxy_bias}
      vixLevel={macro?.vix_level}
      yieldsBias={macro?.yields_bias}
    />

    <!-- Signal Cards Grid -->
    <div class="grid gap-6 md:grid-cols-3">
      <SignalCard
        category="crypto"
        bias={cryptoSignal?.bias}
        summary={extractSummary(cryptoSignal)}
        assetCount={cryptoAssetCount}
        updatedAt={cryptoSignal?.generated_at}
      />
      <SignalCard
        category="forex"
        bias={forexSignal?.bias}
        summary={extractSummary(forexSignal)}
        assetCount={forexAssetCount}
        updatedAt={forexSignal?.generated_at}
      />
      <SignalCard
        category="stocks"
        bias={stocksSignal?.bias}
        summary={extractSummary(stocksSignal)}
        assetCount={stocksAssetCount}
        updatedAt={stocksSignal?.generated_at}
      />
    </div>

    <!-- Telegram CTA -->
    <TelegramCTA variant="full" />

    <!-- Update Schedule -->
    <div class="text-center text-sm text-gray-500">
      <p>
        Last updated: {cryptoSignal?.time_slot || "--:--"} UTC &bull;
        Next update: {formatNextUpdate()}
      </p>
    </div>
  </div>

  <Footer slot="footer" />
</BaseLayout>
```

**Step 2: Commit**

```
git add src/pages/index.astro && git commit -m "feat: implement Home page with signal overview"
```

---

### Phase 9 Checkpoint

```bash
# Apply migrations and seed data
npm run db:migrate:local
npm run db:seed

# Run with D1 binding
npm run dev:wrangler

# Visit http://localhost:8788/ and verify:
# - Macro bar shows Risk-on
# - 3 signal cards display
# - Telegram CTA renders
```

---

## Phase 10: Category Pages

### Task 9: Create BiasIndicator component

**Files:**
- Create: `src/components/BiasIndicator.astro`

**Step 1: Write BiasIndicator**

```astro
---
// src/components/BiasIndicator.astro
interface Props {
  bias: string | null;
  size?: "sm" | "md" | "lg";
}

const { bias, size = "md" } = Astro.props;

function getBiasInfo(bias: string | null) {
  if (!bias) return { color: "text-gray-400 bg-gray-700", label: "Unknown", arrow: "" };
  const lower = bias.toLowerCase();
  if (lower.includes("bullish")) return { color: "text-bullish bg-bullish/10", label: bias, arrow: "^" };
  if (lower.includes("bearish")) return { color: "text-bearish bg-bearish/10", label: bias, arrow: "v" };
  return { color: "text-neutral bg-neutral/10", label: bias, arrow: "-" };
}

const { color, label, arrow } = getBiasInfo(bias);

const sizeClasses = {
  sm: "text-sm px-2 py-1",
  md: "text-base px-3 py-1.5",
  lg: "text-lg px-4 py-2",
};
---

<span class:list={["inline-flex items-center gap-1 rounded-full font-semibold", color, sizeClasses[size]]}>
  {label}
  {arrow && <span class="opacity-70">{arrow}</span>}
</span>
```

**Step 2: Commit**

```
git add src/components/BiasIndicator.astro && git commit -m "feat: add BiasIndicator component"
```

---

### Task 10: Create SignalDetail component

**Files:**
- Create: `src/components/SignalDetail.astro`

**Step 1: Write SignalDetail**

```astro
---
// src/components/SignalDetail.astro
import BiasIndicator from "./BiasIndicator.astro";

interface Props {
  signal: {
    id: number;
    bias: string;
    date: string;
    time_slot: string;
    generated_at: string;
    macro_overall: string | null;
    output_json: string | null;
  };
}

const { signal } = Astro.props;

function parseOutput(outputJson: string | null) {
  if (!outputJson) return null;
  try {
    return JSON.parse(outputJson);
  } catch {
    return null;
  }
}

const output = parseOutput(signal.output_json);

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}
---

<div class="card space-y-6">
  <!-- Header -->
  <div class="flex flex-wrap items-center justify-between gap-4">
    <div class="flex items-center gap-4">
      <BiasIndicator bias={signal.bias} size="lg" />
      {signal.macro_overall && (
        <span class="text-sm text-gray-400">
          Macro: {signal.macro_overall}
        </span>
      )}
    </div>
    <div class="text-sm text-gray-400">
      {formatDate(signal.date)} at {signal.time_slot} UTC
    </div>
  </div>

  <!-- Summary -->
  {output?.summary && (
    <div class="text-lg text-gray-200 leading-relaxed">
      {output.summary}
    </div>
  )}

  <!-- Key Levels -->
  {output?.levels && (
    <div class="space-y-2">
      <h3 class="text-sm font-medium text-gray-400 uppercase tracking-wide">Key Levels</h3>
      <div class="flex flex-wrap gap-4 text-sm">
        {Object.entries(output.levels).map(([key, value]) => (
          <div class="bg-gray-700/50 rounded px-3 py-1.5">
            <span class="text-gray-400">{key.replace(/_/g, " ")}:</span>
            <span class="text-white ml-1 font-mono">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )}

  <!-- Triggers -->
  {output?.triggers && output.triggers.length > 0 && (
    <div class="space-y-2">
      <h3 class="text-sm font-medium text-gray-400 uppercase tracking-wide">Triggers</h3>
      <ul class="space-y-1">
        {output.triggers.map((trigger: string) => (
          <li class="text-sm text-gray-300 flex items-start gap-2">
            <span class="text-blue-400 mt-0.5">-</span>
            {trigger}
          </li>
        ))}
      </ul>
    </div>
  )}

  <!-- Risks -->
  {output?.risks && output.risks.length > 0 && (
    <div class="space-y-2">
      <h3 class="text-sm font-medium text-gray-400 uppercase tracking-wide">Risks</h3>
      <ul class="space-y-1">
        {output.risks.map((risk: string) => (
          <li class="text-sm text-gray-300 flex items-start gap-2">
            <span class="text-amber-400 mt-0.5">!</span>
            {risk}
          </li>
        ))}
      </ul>
    </div>
  )}
</div>
```

**Step 2: Commit**

```
git add src/components/SignalDetail.astro && git commit -m "feat: add SignalDetail component"
```

---

### Task 11: Create AssetTable component

**Files:**
- Create: `src/components/AssetTable.astro`

**Step 1: Write AssetTable**

```astro
---
// src/components/AssetTable.astro
import BiasIndicator from "./BiasIndicator.astro";

interface Asset {
  id: number;
  ticker: string;
  bias: string | null;
  price: number | null;
  vs_20d_ma: string | null;
  secondary_ind: string | null;
}

interface Props {
  assets: Asset[];
  category: "crypto" | "forex" | "stocks";
}

const { assets, category } = Astro.props;

const secondaryLabel: Record<string, string> = {
  crypto: "Funding",
  forex: "RSI(14)",
  stocks: "vs SPY",
};

function formatPrice(price: number | null, cat: string): string {
  if (price === null) return "--";
  if (cat === "forex") return price.toFixed(4);
  if (price > 1000) return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return price.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function formatSecondary(value: string | null, cat: string): string {
  if (value === null) return "--";
  if (cat === "crypto") {
    const num = parseFloat(value);
    return (num * 100).toFixed(3) + "%";
  }
  return value;
}
---

<div class="overflow-x-auto">
  <table class="w-full text-sm">
    <thead>
      <tr class="border-b border-gray-700 text-left text-gray-400">
        <th class="pb-3 font-medium">Ticker</th>
        <th class="pb-3 font-medium">Price</th>
        <th class="pb-3 font-medium">vs 20D MA</th>
        <th class="pb-3 font-medium">{secondaryLabel[category]}</th>
        <th class="pb-3 font-medium">Bias</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-gray-700/50">
      {assets.map((asset) => (
        <tr class="hover:bg-gray-700/30 transition-colors">
          <td class="py-3 font-mono font-medium text-white">{asset.ticker}</td>
          <td class="py-3 font-mono">{formatPrice(asset.price, category)}</td>
          <td class="py-3">
            <span class:list={[
              "px-2 py-0.5 rounded text-xs",
              asset.vs_20d_ma === "above" ? "bg-bullish/20 text-bullish" : "bg-bearish/20 text-bearish"
            ]}>
              {asset.vs_20d_ma || "--"}
            </span>
          </td>
          <td class="py-3 font-mono">{formatSecondary(asset.secondary_ind, category)}</td>
          <td class="py-3">
            <BiasIndicator bias={asset.bias} size="sm" />
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

**Step 2: Commit**

```
git add src/components/AssetTable.astro && git commit -m "feat: add AssetTable component"
```

---

### Task 12: Create HistoryMini component

**Files:**
- Create: `src/components/HistoryMini.astro`

**Step 1: Write HistoryMini**

```astro
---
// src/components/HistoryMini.astro
import BiasIndicator from "./BiasIndicator.astro";

interface Signal {
  id: number;
  date: string;
  time_slot: string;
  bias: string;
}

interface Props {
  signals: Signal[];
  category: "crypto" | "forex" | "stocks";
}

const { signals, category } = Astro.props;

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}
---

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h3 class="text-sm font-medium text-gray-400 uppercase tracking-wide">Recent Signals</h3>
    <a href={`/${category}/history`} class="text-sm text-blue-400 hover:text-blue-300 transition-colors">
      View all &rarr;
    </a>
  </div>

  <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
    {signals.slice(0, 7).map((signal) => (
      <div class="bg-gray-700/30 rounded-lg px-3 py-2 flex items-center justify-between">
        <div class="text-xs text-gray-400">
          {formatDate(signal.date)} {signal.time_slot}
        </div>
        <BiasIndicator bias={signal.bias} size="sm" />
      </div>
    ))}
  </div>

  {signals.length === 0 && (
    <p class="text-sm text-gray-500 italic">No historical signals available yet.</p>
  )}
</div>
```

**Step 2: Commit**

```
git add src/components/HistoryMini.astro && git commit -m "feat: add HistoryMini component"
```

---

### Task 13: Create category page template

**Files:**
- Create: `src/pages/crypto/index.astro`

**Step 1: Write crypto page**

```astro
---
// src/pages/crypto/index.astro
import BaseLayout from "../../layouts/BaseLayout.astro";
import Header from "../../components/Header.astro";
import Footer from "../../components/Footer.astro";
import MacroBar from "../../components/MacroBar.astro";
import SignalDetail from "../../components/SignalDetail.astro";
import AssetTable from "../../components/AssetTable.astro";
import HistoryMini from "../../components/HistoryMini.astro";
import TelegramCTA from "../../components/TelegramCTA.astro";
import { getLatestMacro, getLatestSignal, getAssetSignals, getSignalHistory } from "../../lib/db";

const category = "crypto" as const;
const categoryTitle = "Crypto";
const categoryDescription = "Daily Bitcoin and Ethereum market signals with bias, key levels, and risk analysis.";

const db = Astro.locals.runtime?.env?.DB;

let macro = null;
let signal = null;
let assets: any[] = [];
let history: any[] = [];

if (db) {
  [macro, signal] = await Promise.all([
    getLatestMacro(db),
    getLatestSignal(db, category),
  ]);

  if (signal) {
    [assets, history] = await Promise.all([
      getAssetSignals(db, signal.id),
      getSignalHistory(db, category, 7),
    ]);
  }
}
---

<BaseLayout title={categoryTitle} description={categoryDescription}>
  <Header slot="header" />

  <div class="space-y-8">
    <!-- Breadcrumb -->
    <nav class="text-sm text-gray-400">
      <a href="/" class="hover:text-white transition-colors">Home</a>
      <span class="mx-2">/</span>
      <span class="text-white">{categoryTitle}</span>
    </nav>

    <!-- Page Header -->
    <div>
      <h1 class="text-3xl font-bold text-white mb-2">{categoryTitle} Signals</h1>
      <p class="text-gray-400">BTC, ETH daily analysis</p>
    </div>

    <!-- Macro Context -->
    <MacroBar
      overall={macro?.overall}
      dxyBias={macro?.dxy_bias}
      vixLevel={macro?.vix_level}
      yieldsBias={macro?.yields_bias}
    />

    <!-- Current Signal -->
    {signal ? (
      <SignalDetail signal={signal} />
    ) : (
      <div class="card text-center py-12">
        <p class="text-gray-400">No signal available yet. Check back at the next update.</p>
      </div>
    )}

    <!-- Asset Table -->
    {assets.length > 0 && (
      <div class="card">
        <h2 class="text-lg font-semibold text-white mb-4">Asset Breakdown</h2>
        <AssetTable assets={assets} category={category} />
      </div>
    )}

    <!-- History Mini -->
    <div class="card">
      <HistoryMini signals={history} category={category} />
    </div>

    <!-- Telegram CTA -->
    <TelegramCTA variant="compact" />
  </div>

  <Footer slot="footer" />
</BaseLayout>
```

**Step 2: Commit**

```
git add src/pages/crypto/index.astro && git commit -m "feat: add crypto category page"
```

---

### Task 14: Create forex and stocks category pages

**Files:**
- Create: `src/pages/forex/index.astro`
- Create: `src/pages/stocks/index.astro`

**Step 1: Write forex page**

Copy crypto page and modify:
- `category = "forex"`
- `categoryTitle = "Forex"`
- `categoryDescription = "Daily forex signals for USD/JPY, EUR/USD, USD/CAD, USD/AUD."`
- Asset description: "4 major currency pairs"

**Step 2: Write stocks page**

Copy crypto page and modify:
- `category = "stocks"`
- `categoryTitle = "Stocks"`
- `categoryDescription = "Daily stock signals for semiconductors, AI infrastructure, and energy sectors."`
- Asset description: "25 tickers across 3 sectors"

**Step 3: Commit**

```
git add src/pages/forex/index.astro src/pages/stocks/index.astro && git commit -m "feat: add forex and stocks category pages"
```

---

### Phase 10 Checkpoint

```bash
# Run with D1 binding
npm run dev:wrangler

# Visit and verify:
# http://localhost:8788/crypto
# http://localhost:8788/forex
# http://localhost:8788/stocks

# Each should show:
# - Macro bar
# - Signal detail (bias, summary, levels, risks)
# - Asset table
# - 7-day history mini
# - Telegram CTA
```

---

## Phase 11: History Pages

### Task 15: Create HistoryList component

**Files:**
- Create: `src/components/HistoryList.astro`

**Step 1: Write HistoryList**

```astro
---
// src/components/HistoryList.astro
import BiasIndicator from "./BiasIndicator.astro";

interface Signal {
  id: number;
  date: string;
  time_slot: string;
  bias: string;
  macro_overall: string | null;
  output_json: string | null;
}

interface Props {
  signals: Signal[];
  category: "crypto" | "forex" | "stocks";
}

const { signals, category } = Astro.props;

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function extractSummary(outputJson: string | null): string | null {
  if (!outputJson) return null;
  try {
    const output = JSON.parse(outputJson);
    return output.summary || null;
  } catch {
    return null;
  }
}
---

<div class="space-y-4">
  {signals.map((signal) => (
    <div class="card hover:border-gray-600 transition-colors">
      <div class="flex flex-wrap items-start justify-between gap-4 mb-3">
        <div>
          <div class="text-white font-medium">{formatDate(signal.date)}</div>
          <div class="text-sm text-gray-400">{signal.time_slot} UTC</div>
        </div>
        <div class="flex items-center gap-3">
          {signal.macro_overall && (
            <span class="text-sm text-gray-400">{signal.macro_overall}</span>
          )}
          <BiasIndicator bias={signal.bias} size="md" />
        </div>
      </div>
      {extractSummary(signal.output_json) && (
        <p class="text-sm text-gray-300 line-clamp-2">
          {extractSummary(signal.output_json)}
        </p>
      )}
    </div>
  ))}

  {signals.length === 0 && (
    <div class="card text-center py-12">
      <p class="text-gray-400">No historical signals available yet.</p>
    </div>
  )}
</div>
```

**Step 2: Commit**

```
git add src/components/HistoryList.astro && git commit -m "feat: add HistoryList component"
```

---

### Task 16: Create history page template

**Files:**
- Create: `src/pages/crypto/history.astro`

**Step 1: Write crypto history page**

```astro
---
// src/pages/crypto/history.astro
import BaseLayout from "../../layouts/BaseLayout.astro";
import Header from "../../components/Header.astro";
import Footer from "../../components/Footer.astro";
import HistoryList from "../../components/HistoryList.astro";
import { getSignalHistory } from "../../lib/db";

const category = "crypto" as const;
const categoryTitle = "Crypto";

const db = Astro.locals.runtime?.env?.DB;
let signals: any[] = [];

if (db) {
  signals = await getSignalHistory(db, category, 30);
}
---

<BaseLayout title={`${categoryTitle} History`} description={`Historical ${categoryTitle.toLowerCase()} signals archive.`}>
  <Header slot="header" />

  <div class="space-y-8">
    <!-- Breadcrumb -->
    <nav class="text-sm text-gray-400">
      <a href="/" class="hover:text-white transition-colors">Home</a>
      <span class="mx-2">/</span>
      <a href={`/${category}`} class="hover:text-white transition-colors">{categoryTitle}</a>
      <span class="mx-2">/</span>
      <span class="text-white">History</span>
    </nav>

    <!-- Page Header -->
    <div>
      <h1 class="text-3xl font-bold text-white mb-2">{categoryTitle} Signal History</h1>
      <p class="text-gray-400">{signals.length} signals in archive</p>
    </div>

    <!-- Signal List -->
    <HistoryList signals={signals} category={category} />
  </div>

  <Footer slot="footer" />
</BaseLayout>
```

**Step 2: Commit**

```
git add src/pages/crypto/history.astro && git commit -m "feat: add crypto history page"
```

---

### Task 17: Create forex and stocks history pages

**Files:**
- Create: `src/pages/forex/history.astro`
- Create: `src/pages/stocks/history.astro`

**Step 1: Copy and modify for forex and stocks**

Update category and categoryTitle appropriately.

**Step 2: Commit**

```
git add src/pages/forex/history.astro src/pages/stocks/history.astro && git commit -m "feat: add forex and stocks history pages"
```

---

## Phase 12: About Page

### Task 18: Create About page

**Files:**
- Create: `src/pages/about.astro`

**Step 1: Write About page**

```astro
---
// src/pages/about.astro
import BaseLayout from "../layouts/BaseLayout.astro";
import Header from "../components/Header.astro";
import Footer from "../components/Footer.astro";
import TelegramCTA from "../components/TelegramCTA.astro";
---

<BaseLayout title="About" description="Learn about EverInvests methodology and signal generation process.">
  <Header slot="header" />

  <div class="max-w-3xl mx-auto space-y-8">
    <h1 class="text-3xl font-bold text-white">About EverInvests</h1>

    <div class="prose prose-invert prose-gray max-w-none space-y-6">
      <p class="text-lg text-gray-300">
        EverInvests provides free, automated daily market signals for Crypto, Forex, and Stocks.
        Our signals are generated using a rule-based system combined with AI-powered summaries.
      </p>

      <h2 class="text-xl font-semibold text-white mt-8 mb-4">Methodology</h2>

      <div class="card space-y-4">
        <h3 class="font-medium text-white">1. Macro Context</h3>
        <p class="text-gray-300 text-sm">
          We analyze three key macro indicators to determine overall market conditions:
        </p>
        <ul class="text-sm text-gray-300 space-y-1 ml-4">
          <li>- <strong>DXY (US Dollar Index):</strong> Price vs 20-day moving average</li>
          <li>- <strong>VIX (Volatility Index):</strong> Below 20 = Risk-on, Above 25 = Risk-off</li>
          <li>- <strong>US 10Y Yields:</strong> Rising = bearish for risk assets</li>
        </ul>
      </div>

      <div class="card space-y-4">
        <h3 class="font-medium text-white">2. Per-Asset Analysis</h3>
        <p class="text-gray-300 text-sm">
          Each asset is evaluated using two indicators:
        </p>
        <ul class="text-sm text-gray-300 space-y-1 ml-4">
          <li>- <strong>Primary:</strong> Price vs 20-day moving average</li>
          <li>- <strong>Secondary:</strong> Funding rate (crypto), RSI (forex), or relative strength (stocks)</li>
        </ul>
        <p class="text-gray-300 text-sm">
          Scoring: 2 bullish indicators = Bullish, 2 bearish = Bearish, otherwise Neutral.
        </p>
      </div>

      <div class="card space-y-4">
        <h3 class="font-medium text-white">3. AI-Powered Summaries</h3>
        <p class="text-gray-300 text-sm">
          Each signal includes a 1-2 sentence summary generated by AI, providing context
          and highlighting key levels and risks in plain English.
        </p>
      </div>

      <h2 class="text-xl font-semibold text-white mt-8 mb-4">Update Schedule (UTC)</h2>

      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-700 text-left text-gray-400">
              <th class="pb-3">Category</th>
              <th class="pb-3">Assets</th>
              <th class="pb-3">Updates</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-700/50 text-gray-300">
            <tr>
              <td class="py-3">Crypto</td>
              <td class="py-3">BTC, ETH</td>
              <td class="py-3">00:00, 08:00, 16:00 (daily)</td>
            </tr>
            <tr>
              <td class="py-3">Forex</td>
              <td class="py-3">USD/JPY, EUR/USD, USD/CAD, USD/AUD</td>
              <td class="py-3">00:00, 08:00, 14:00 (weekdays)</td>
            </tr>
            <tr>
              <td class="py-3">Stocks</td>
              <td class="py-3">25 tickers (semis, AI, energy)</td>
              <td class="py-3">17:00, 21:00 (weekdays)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 class="text-xl font-semibold text-white mt-8 mb-4">Disclaimer</h2>

      <p class="text-sm text-gray-400">
        EverInvests signals are for educational and informational purposes only. They do not constitute
        financial advice, investment recommendations, or trading signals. Always do your own research
        and consult with qualified professionals before making investment decisions. Past performance
        does not guarantee future results.
      </p>
    </div>

    <TelegramCTA variant="full" />
  </div>

  <Footer slot="footer" />
</BaseLayout>
```

**Step 2: Commit**

```
git add src/pages/about.astro && git commit -m "feat: add About page with methodology"
```

---

## Phase 13: Production Deployment

### Task 19: Configure production secrets

**Files:** None (Cloudflare Dashboard)

**Step 1: Configure Pages D1 binding**

1. Go to Cloudflare Dashboard → Workers & Pages
2. Select `everinvests` Pages project (or create via `npm run deploy`)
3. Settings → Functions → D1 database bindings
4. Add binding: Variable name = `DB`, D1 database = `everinvests-db`

**Step 2: Configure Worker secrets**

```bash
cd worker
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID
wrangler secret put TWELVEDATA_API_KEY
wrangler secret put ALPHAVANTAGE_API_KEY
wrangler secret put OPENROUTER_API_KEY
```

---

### Task 20: Deploy to production

**Step 1: Deploy Astro site**

```bash
npm run build
npm run deploy
```

**Step 2: Deploy Worker**

```bash
cd worker && npm run deploy
```

**Step 3: Verify deployment**

- Visit https://everinvests.pages.dev (or custom domain)
- Verify all pages load
- Check API endpoints return data

---

### Task 21: End-to-end verification

**Checklist:**
- [ ] Homepage loads with macro bar and 3 signal cards
- [ ] Each category page shows signal detail and asset table
- [ ] History pages show archived signals
- [ ] About page displays methodology
- [ ] API endpoints return valid JSON
- [ ] Worker cron fires at scheduled times (check logs)
- [ ] Telegram messages post correctly

---

## Phase 14: SEO & Polish

### Task 22: Add meta tags and Open Graph

**Files:**
- Modify: `src/layouts/BaseLayout.astro`

Add Open Graph meta tags for social sharing.

---

### Task 23: Create sitemap

**Files:**
- Create: `src/pages/sitemap.xml.ts`

Generate dynamic XML sitemap from category pages.

---

### Task 24: Performance optimization

**Checklist:**
- [ ] Add preconnect hints for external domains
- [ ] Verify Lighthouse score > 90
- [ ] Enable Cloudflare caching headers
- [ ] Add favicon.svg

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| Phase 8 | 1-4 | Tailwind CSS, BaseLayout, Header, Footer |
| Phase 9 | 5-8 | MacroBar, SignalCard, TelegramCTA, Home page |
| Phase 10 | 9-14 | BiasIndicator, SignalDetail, AssetTable, HistoryMini, 3 category pages |
| Phase 11 | 15-17 | HistoryList, 3 history pages |
| Phase 12 | 18 | About page |
| Phase 13 | 19-21 | Secrets, deploy, E2E verification |
| Phase 14 | 22-24 | Meta tags, sitemap, performance |

**Total: 24 tasks across 7 phases**

---

## Component Dependency Graph

```
BaseLayout
├── Header
├── Footer
└── (page content)

Home Page
├── MacroBar
├── SignalCard (x3)
└── TelegramCTA

Category Page
├── MacroBar
├── SignalDetail
│   └── BiasIndicator
├── AssetTable
│   └── BiasIndicator
├── HistoryMini
│   └── BiasIndicator
└── TelegramCTA

History Page
└── HistoryList
    └── BiasIndicator
```

---

*Document generated: 2026-01-15*
