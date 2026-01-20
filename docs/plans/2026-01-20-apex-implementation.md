# Apex Implementation Plan

**Date:** 2026-01-20
**Status:** Ready to Execute
**Version:** 1.1 (Revised after critique)
**Baseline:** EverInvests Phase 0-5 complete (agent-skill evolution)
**Design Doc:** [2026-01-20-apex-design.md](./2026-01-20-apex-design.md)

---

## Guiding Principles

1. **No breaking changes** - Existing signal-worker keeps running
2. **Additive migrations** - Only add tables, never modify existing
3. **Skill pattern** - All new logic as versioned skills
4. **Revenue first** - Ship paying MVP before advanced features
5. **10ms CPU budget** - Keep Phase 1 simple to stay within limits
6. **Test APIs first** - Verify Deribit works from CF Workers before building

---

## Revised Scope (After Critique)

**IN SCOPE (6-Week MVP):**
- Bot-worker with user management
- MemberPaywall subscription integration
- Tier-based message formatting
- Confidence score (simple arithmetic, no new data sources)
- Invalidation levels (price-based thresholds)
- Rate limiting and error handling

**DEFERRED (Post-Launch):**
- 8-regime taxonomy
- Deribit derivatives integration
- Directive translation skill
- Real-time alerts
- Execution scaffold

---

## Phase 1: Bot Worker + User Management

**Duration:** 5-7 days
**Goal:** Users can subscribe and receive signals via bot

### Task 1.1: Scaffold bot-worker

**Files to create:**
```
bot-worker/
├── package.json
├── tsconfig.json
├── wrangler.toml
└── src/
    ├── index.ts        # Main entry, webhook handler
    ├── env.ts          # Environment interface
    └── types.ts        # Bot-specific types
```

**wrangler.toml:**
```toml
name = "apex-bot"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "everinvests-db"
database_id = "92386766-33b5-4dc8-a594-abf6fc4e6600"

[vars]
SITE_URL = "https://everinvests.com"
```

**Acceptance:**
- [ ] `npm run bot:dev` starts local worker
- [ ] Worker responds to HTTP requests

### Task 1.2: D1 Migration 0005

**File:** `migrations/0005_users_subscriptions.sql`

```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id     TEXT NOT NULL UNIQUE,
  telegram_name   TEXT,
  telegram_username TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT,
  -- Preferences
  risk_profile    TEXT DEFAULT 'moderate',
  categories      TEXT DEFAULT '["crypto"]',
  language        TEXT DEFAULT 'en',
  timezone        TEXT DEFAULT 'UTC'
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  tier            TEXT NOT NULL DEFAULT 'free',
  status          TEXT NOT NULL DEFAULT 'active',
  provider        TEXT,
  provider_sub_id TEXT,
  started_at      TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at      TEXT,
  amount_cents    INTEGER,
  currency        TEXT DEFAULT 'USD',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_telegram ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_subs_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subs_status ON subscriptions(status, expires_at);
```

**Commands:**
```bash
npm run db:migrate:local
npm run db:migrate:remote
```

**Acceptance:**
- [ ] Migration applies without errors
- [ ] Tables visible in D1 dashboard

### Task 1.3: User DB Functions

**File:** `bot-worker/src/db/users.ts`

```typescript
import type { D1Database } from '@cloudflare/workers-types';

export interface User {
  id: number;
  telegram_id: string;
  telegram_name: string | null;
  telegram_username: string | null;
  created_at: string;
  risk_profile: string;
  categories: string;
  language: string;
  timezone: string;
}

export async function getOrCreateUser(
  db: D1Database,
  telegramId: string,
  name?: string,
  username?: string
): Promise<User> {
  // Try to find existing user
  const existing = await db.prepare(
    'SELECT * FROM users WHERE telegram_id = ?'
  ).bind(telegramId).first<User>();

  if (existing) {
    return existing;
  }

  // Create new user
  const result = await db.prepare(`
    INSERT INTO users (telegram_id, telegram_name, telegram_username)
    VALUES (?, ?, ?)
    RETURNING *
  `).bind(telegramId, name || null, username || null).first<User>();

  return result!;
}

export async function getUserTier(db: D1Database, userId: number): Promise<string> {
  const sub = await db.prepare(`
    SELECT tier FROM subscriptions
    WHERE user_id = ? AND status = 'active'
    AND (expires_at IS NULL OR expires_at > datetime('now'))
    ORDER BY tier DESC LIMIT 1
  `).bind(userId).first<{ tier: string }>();

  return sub?.tier || 'free';
}
```

**Acceptance:**
- [ ] getOrCreateUser creates user on first call
- [ ] getOrCreateUser returns existing on second call
- [ ] getUserTier returns 'free' for new users

### Task 1.4: Telegram Webhook Handler

**File:** `bot-worker/src/index.ts`

```typescript
import type { Env } from './env';
import { handleStart } from './commands/start';
import { handleSignal } from './commands/signal';
import { handleSubscribe } from './commands/subscribe';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Telegram webhook
    if (url.pathname === '/webhook' && request.method === 'POST') {
      const update = await request.json() as TelegramUpdate;
      return handleTelegramUpdate(update, env);
    }

    // MemberPaywall webhook
    if (url.pathname === '/memberpaywall' && request.method === 'POST') {
      return handleMemberPaywallWebhook(request, env);
    }

    // Health check
    if (url.pathname === '/health') {
      return new Response('OK');
    }

    return new Response('Not found', { status: 404 });
  },
};

async function handleTelegramUpdate(update: TelegramUpdate, env: Env): Promise<Response> {
  const message = update.message;
  if (!message?.text) {
    return new Response('OK');
  }

  const text = message.text.trim();
  const chatId = message.chat.id.toString();
  const userId = message.from?.id.toString() || chatId;
  const userName = message.from?.first_name;
  const userUsername = message.from?.username;

  try {
    if (text.startsWith('/start')) {
      await handleStart(env, chatId, userId, userName, userUsername);
    } else if (text.startsWith('/signal')) {
      const category = text.split(' ')[1] || 'crypto';
      await handleSignal(env, chatId, userId, category);
    } else if (text.startsWith('/subscribe')) {
      await handleSubscribe(env, chatId, userId);
    } else if (text.startsWith('/help')) {
      await sendMessage(env, chatId, HELP_MESSAGE);
    }
  } catch (error) {
    console.error('Command error:', error);
    await sendMessage(env, chatId, 'Sorry, something went wrong. Please try again.');
  }

  return new Response('OK');
}
```

**Acceptance:**
- [ ] Webhook receives Telegram updates
- [ ] Commands are routed correctly
- [ ] Errors don't crash the worker

### Task 1.5: Command Handlers

**File:** `bot-worker/src/commands/start.ts`

```typescript
import { getOrCreateUser, getUserTier } from '../db/users';
import { sendMessage } from '../telegram';

export async function handleStart(
  env: Env,
  chatId: string,
  telegramId: string,
  name?: string,
  username?: string
): Promise<void> {
  const user = await getOrCreateUser(env.DB, telegramId, name, username);
  const tier = await getUserTier(env.DB, user.id);

  const welcome = tier === 'free'
    ? WELCOME_FREE
    : WELCOME_SUBSCRIBED.replace('{tier}', tier);

  await sendMessage(env, chatId, welcome);
}

const WELCOME_FREE = `
Welcome to Apex Intelligence Network!

Get daily market signals for Crypto, Forex, and Stocks.

Commands:
/signal [crypto|forex|stocks] - Latest signal
/subscribe - Upgrade for full analysis
/help - Show all commands

Free users see: Bias + Summary
Subscribers see: Regime + Directive + Evidence

Start with /signal crypto
`;

const WELCOME_SUBSCRIBED = `
Welcome back! You're on {tier}.

Commands:
/signal [crypto|forex|stocks] - Full signal with regime
/help - Show all commands

Your benefits:
- Full regime analysis
- Actionable directives
- Evidence chain
- Invalidation alerts
`;
```

**File:** `bot-worker/src/commands/signal.ts`

```typescript
import { getOrCreateUser, getUserTier } from '../db/users';
import { getLatestSignal } from '../db/signals';
import { formatSignalForTier } from '../delivery/formatTier';
import { sendMessage } from '../telegram';

export async function handleSignal(
  env: Env,
  chatId: string,
  telegramId: string,
  category: string
): Promise<void> {
  // Normalize category
  const cat = category.toLowerCase();
  if (!['crypto', 'forex', 'stocks'].includes(cat)) {
    await sendMessage(env, chatId, 'Invalid category. Use: crypto, forex, or stocks');
    return;
  }

  const user = await getOrCreateUser(env.DB, telegramId);
  const tier = await getUserTier(env.DB, user.id);

  const signal = await getLatestSignal(env.DB, cat);
  if (!signal) {
    await sendMessage(env, chatId, `No signals available for ${cat} yet.`);
    return;
  }

  const message = formatSignalForTier(signal, tier);
  await sendMessage(env, chatId, message);
}
```

**File:** `bot-worker/src/commands/subscribe.ts`

```typescript
export async function handleSubscribe(
  env: Env,
  chatId: string,
  telegramId: string
): Promise<void> {
  const subscribeUrl = env.MEMBERPAYWALL_URL || 'https://memberpaywall.org/apex';

  const message = `
Upgrade to Apex Premium!

Tier 1 ($49/mo):
- Full regime analysis (8 market states)
- Actionable directives
- Evidence chain for every signal
- Weekly performance recap

Tier 2 ($199/mo):
- Everything in Tier 1
- Real-time threshold alerts
- Semi-auto execution (coming soon)
- Priority support

Subscribe here: ${subscribeUrl}?telegram_id=${telegramId}
`;

  await sendMessage(env, chatId, message);
}
```

**Acceptance:**
- [ ] /start creates user and shows welcome
- [ ] /signal returns formatted signal
- [ ] /subscribe shows upgrade link

### Task 1.6: MemberPaywall Webhook

**File:** `bot-worker/src/webhooks/memberpaywall.ts`

```typescript
export async function handleMemberPaywallWebhook(
  request: Request,
  env: Env
): Promise<Response> {
  // Verify webhook signature (if MemberPaywall provides one)
  const signature = request.headers.get('X-Webhook-Signature');
  // TODO: Verify signature

  const payload = await request.json() as MemberPaywallEvent;

  switch (payload.event) {
    case 'subscription.created':
    case 'subscription.updated':
      await syncSubscription(env.DB, payload.data);
      break;
    case 'subscription.cancelled':
      await cancelSubscription(env.DB, payload.data);
      break;
  }

  return new Response('OK');
}

async function syncSubscription(db: D1Database, data: SubscriptionData) {
  // Find or create user by telegram_id
  const user = await getOrCreateUser(db, data.telegram_id);

  // Upsert subscription
  await db.prepare(`
    INSERT INTO subscriptions (user_id, tier, status, provider, provider_sub_id, expires_at)
    VALUES (?, ?, 'active', 'memberpaywall', ?, ?)
    ON CONFLICT (user_id, tier) DO UPDATE SET
      status = 'active',
      provider_sub_id = excluded.provider_sub_id,
      expires_at = excluded.expires_at,
      updated_at = datetime('now')
  `).bind(user.id, data.plan_id, data.subscription_id, data.expires_at).run();
}
```

**Acceptance:**
- [ ] Webhook updates subscription in D1
- [ ] User tier changes after payment

### Task 1.7: Deploy and Test

**Commands:**
```bash
# Deploy bot worker
cd bot-worker && npm run deploy

# Set webhook URL
curl -X POST "https://api.telegram.org/bot{TOKEN}/setWebhook" \
  -d "url=https://apex-bot.{account}.workers.dev/webhook"

# Test commands
# Send /start to bot in Telegram
# Send /signal crypto to bot
```

**Acceptance:**
- [ ] Bot responds in Telegram
- [ ] Commands work end-to-end
- [ ] Subscription webhook updates tier

---

## Phase 2: Tiered Delivery

**Duration:** 3-4 days
**Goal:** Same signals, different formatting by tier

### Task 2.1: Format Functions

**File:** `bot-worker/src/delivery/formatTier.ts`

```typescript
import type { Signal, AssetSignal } from '../../worker/src/types';

export function formatSignalForTier(signal: Signal, tier: string): string {
  switch (tier) {
    case 'tier2':
      return formatTier2(signal);
    case 'tier1':
      return formatTier1(signal);
    default:
      return formatFree(signal);
  }
}

function formatFree(signal: Signal): string {
  const output = JSON.parse(signal.output_json);
  const emoji = signal.bias === 'Bullish' ? '🟢' : signal.bias === 'Bearish' ? '🔴' : '🟡';

  return `
${emoji} ${signal.category.toUpperCase()} | ${signal.date} ${signal.time_slot} UTC

Bias: ${signal.bias}

${output.summary}

⚠️ Research only. Not financial advice.

🔗 Full analysis: Subscribe with /subscribe
`;
}

function formatTier1(signal: Signal): string {
  const output = JSON.parse(signal.output_json);
  const emoji = signal.bias === 'Bullish' ? '🟢' : signal.bias === 'Bearish' ? '🔴' : '🟡';

  // Phase 2: Add regime when available
  const regimeSection = output.regime
    ? `
═══════════════════════════════
REGIME: ${output.regime.type}
Confidence: ${(output.regime.confidence * 100).toFixed(0)}%
═══════════════════════════════
`
    : '';

  // Phase 2: Add directive when available
  const directiveSection = output.directive
    ? `
📈 DIRECTIVE:
• Position: ${output.directive.positionSize}
• Max Leverage: ${output.directive.maxLeverage}x
• Stop-Loss: ${output.directive.stopLoss}
• Entry: ${output.directive.entryTiming}
`
    : '';

  return `
${emoji} ${signal.category.toUpperCase()} SIGNAL | ${signal.date} ${signal.time_slot} UTC
${regimeSection}
Bias: ${signal.bias}
${directiveSection}
${output.summary}

📊 MACRO: ${output.macro?.overall || 'N/A'}

📈 ASSETS:
${formatAssets(output.assets || [])}

⚠️ Research only. Not financial advice.

🔗 everinvests.com/${signal.category}/${signal.date}/${signal.time_slot.replace(':', '-')}
`;
}

function formatAssets(assets: AssetSignal[]): string {
  return assets.slice(0, 5).map(a => {
    const emoji = a.bias === 'Bullish' ? '🟢' : a.bias === 'Bearish' ? '🔴' : '🟡';
    return `${emoji} ${a.ticker}: $${a.price?.toLocaleString() || 'N/A'} (${a.vsMA20})`;
  }).join('\n');
}
```

**Acceptance:**
- [ ] Free users see truncated signal
- [ ] Tier 1 users see full signal
- [ ] Format gracefully handles missing regime (Phase 3)

### Task 2.2: Update Signal Worker Notify

**File:** `worker/src/skills/notifyTelegram.ts` (extend, don't replace)

Add a feature flag for tiered delivery:

```typescript
// Add to existing notifyTelegram skill
interface NotifyInput {
  // ... existing fields
  enableTieredDelivery?: boolean;
}

async function run({ env, input }: SkillArgs<NotifyInput>): Promise<NotifyOutput> {
  // Existing broadcast to public channel (keep)
  await sendToPublicChannel(env, input);

  // NEW: If tiered delivery enabled, also send to subscribers
  if (input.enableTieredDelivery && env.ENABLE_TIERED_DELIVERY === 'true') {
    await sendToSubscribers(env, input);
  }

  return { notified: true };
}

async function sendToSubscribers(env: Env, input: NotifyInput): Promise<void> {
  // Get all tier1+ users who subscribed to this category
  const subscribers = await env.DB.prepare(`
    SELECT u.telegram_id, s.tier
    FROM users u
    JOIN subscriptions s ON s.user_id = u.id
    WHERE s.status = 'active'
    AND s.tier IN ('tier1', 'tier2')
    AND u.categories LIKE ?
  `).bind(`%${input.category}%`).all();

  for (const sub of subscribers.results) {
    const message = formatSignalForTier(input, sub.tier);
    await sendTelegramMessage(env, sub.telegram_id, message);
  }
}
```

**Acceptance:**
- [ ] Public channel still receives broadcasts
- [ ] Subscribers receive enhanced format
- [ ] Feature flag controls behavior

---

## Phase 3: Confidence + Invalidation (Simplified MVP)

**Duration:** 3-4 days
**Goal:** Add Tier 1 value without new data sources or complex skills

**Key Insight:** The 8-regime taxonomy is deferred to post-launch. For MVP, we add:
- Confidence score (0.3-0.95) - simple arithmetic
- Invalidation levels (price-based thresholds)
- Watch levels for monitoring

This achieves 80% of user value with 20% of complexity.

### Task 3.1: Extend computeBias Skill

**File:** `worker/src/skills/computeBias.ts` (modify existing, no new skill)

```typescript
// Add to existing ComputeBiasOutput interface
interface ComputeBiasOutput {
  // EXISTING fields (unchanged)
  categoryBias: Bias;
  assetSignals: AssetSignal[];
  levels: Record<string, number>;
  risks: string[];

  // NEW fields (added)
  confidence: number;           // 0.3-0.95
  invalidation: string;         // Human-readable
  watchLevels: Record<string, number | string>;
}

// Add these functions to computeBias skill
function calculateConfidence(
  bias: Bias,
  assetSignals: AssetSignal[],
  macroSignal: MacroSignal,
  qualityFlags: QualityFlags
): number {
  let confidence = 0.5;

  // +0.15 if macro aligns with bias
  const macroAligns =
    (bias === 'Bullish' && macroSignal.overall === 'Risk-on') ||
    (bias === 'Bearish' && macroSignal.overall === 'Risk-off');
  if (macroAligns) confidence += 0.15;

  // +0.1 if all assets agree
  const allAgree = assetSignals.every(a => a.bias === bias);
  if (allAgree) confidence += 0.1;

  // -0.1 per quality flag
  const flagCount = [
    qualityFlags.missing_assets,
    qualityFlags.macro_fallback,
    qualityFlags.stale_assets?.length > 0,
  ].filter(Boolean).length;
  confidence -= flagCount * 0.1;

  return Math.max(0.3, Math.min(0.95, confidence));
}

function calculateInvalidation(
  bias: Bias,
  assetSignals: AssetSignal[]
): { text: string; watchLevels: Record<string, number> } {
  const btc = assetSignals.find(a => a.ticker === 'BTC');
  const btcPrice = btc?.price || 0;

  switch (bias) {
    case 'Bullish':
      return {
        text: `Invalidates if BTC < $${Math.round(btcPrice * 0.97).toLocaleString()}`,
        watchLevels: { btc_invalidation: btcPrice * 0.97 },
      };
    case 'Bearish':
      return {
        text: `Invalidates if BTC > $${Math.round(btcPrice * 1.03).toLocaleString()}`,
        watchLevels: { btc_invalidation: btcPrice * 1.03 },
      };
    default:
      return {
        text: 'Watch for VIX outside 18-25 range',
        watchLevels: { vix_alert: '18-25' },
      };
  }
}
```

**Key Points:**
- NO new skills - just extend existing computeBias
- NO new data sources - uses existing macro + assets
- Stays within 10ms CPU budget

### Task 3.2: Update storeSignal Skill

**File:** `worker/src/skills/storeSignal.ts`

```typescript
// Add new fields to output_json
const outputJson = {
  // EXISTING
  summary: input.summary,
  levels: input.levels,
  risks: input.risks,
  quality_flags: input.qualityFlags,
  delta: delta,

  // NEW
  confidence: input.confidence,
  invalidation: input.invalidation,
  watchLevels: input.watchLevels,
};
```

### Task 3.3: Update Tier 1 Message Format

**File:** `bot-worker/src/delivery/formatTier.ts`

```typescript
function formatTier1(signal: Signal): string {
  const output = JSON.parse(signal.output_json);
  const emoji = signal.bias === 'Bullish' ? '🟢' : signal.bias === 'Bearish' ? '🔴' : '🟡';
  const confPct = Math.round((output.confidence || 0.5) * 100);

  return `
${emoji} ${signal.category.toUpperCase()} | ${signal.date} ${signal.time_slot} UTC

Bias: ${signal.bias}
Confidence: ${confPct}%

${output.summary}

📊 Macro: ${output.macro?.overall || 'N/A'}

⚠️ ${output.invalidation || 'N/A'}

⚠️ Research only. Not financial advice.
🔗 everinvests.com/${signal.category}
`;
}
```

**Acceptance:**
- [ ] Confidence score 0.3-0.95 in output_json
- [ ] Invalidation text is human-readable
- [ ] Tier 1 messages show confidence + invalidation
- [ ] CPU time within 10ms budget
- [ ] All categories still work

---

## Phase 4+: Advanced Features (POST-LAUNCH)

**DEFERRED until 50+ paying subscribers:**
- Deribit derivatives integration (test API first)
- 8-regime taxonomy
- Directive translation skill
- Real-time alerts
- Execution scaffold

See design doc Section 2.3 for full details.

---

## Testing Checklist

### Phase 1 Tests
- [ ] User creation on /start
- [ ] Signal retrieval by category
- [ ] Tier lookup for free user
- [ ] Subscription webhook processing
- [ ] Tier upgrade after payment

### Phase 2 Tests
- [ ] Free format is truncated
- [ ] Tier 1 format is complete
- [ ] Broadcast + DM both work

### Phase 3 Tests
- [ ] Confidence score calculated correctly
- [ ] Invalidation levels based on price ± 3%
- [ ] Watch levels in output_json
- [ ] Tier 1 message shows new fields
- [ ] CPU time within budget

---

## Deployment Checklist

### Environment Variables

**bot-worker:**
```
TELEGRAM_BOT_TOKEN=xxx
MEMBERPAYWALL_WEBHOOK_SECRET=xxx
SITE_URL=https://everinvests.com
```

**signal-worker (add):**
```
ENABLE_TIERED_DELIVERY=true
```

### Secrets
```bash
cd bot-worker
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put MEMBERPAYWALL_WEBHOOK_SECRET
```

### Migrations
```bash
npm run db:migrate:remote
```

---

*Plan version: 1.0*
*Last updated: 2026-01-20*
