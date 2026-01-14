export interface Env {
  DB: D1Database;
  AI: Ai;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  OPENROUTER_API_KEY?: string;
  TWELVEDATA_API_KEY?: string;
  ALPHAVANTAGE_API_KEY?: string;
}

type Category = "crypto" | "forex" | "stocks";

// Schedule configuration (UTC hours)
const SCHEDULE: Record<Category, { hours: number[]; weekdaysOnly: boolean }> = {
  crypto: { hours: [0, 8, 16], weekdaysOnly: false },
  forex: { hours: [0, 8, 14], weekdaysOnly: true },
  stocks: { hours: [17, 21], weekdaysOnly: true },
};

function getCategoriesToRun(utcHour: number, dayOfWeek: number): Category[] {
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const categories: Category[] = [];

  for (const [category, config] of Object.entries(SCHEDULE) as [Category, typeof SCHEDULE[Category]][]) {
    if (config.hours.includes(utcHour)) {
      if (!config.weekdaysOnly || isWeekday) {
        categories.push(category);
      }
    }
  }

  return categories;
}

function formatTimeSlot(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
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
      const category = url.searchParams.get("category") as Category | null;
      await runScheduledJob(env, "manual", category ? [category] : undefined);
      return new Response("triggered");
    }

    return new Response("everinvests-worker", { status: 200 });
  },
};

async function runScheduledJob(
  env: Env,
  cron: string,
  forceCategories?: Category[]
): Promise<void> {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday
  const date = now.toISOString().split("T")[0];
  const timeSlot = formatTimeSlot(utcHour);

  const categories = forceCategories ?? getCategoriesToRun(utcHour, dayOfWeek);

  if (categories.length === 0) {
    console.log(`[${cron}] No categories scheduled for hour ${utcHour}`);
    return;
  }

  console.log(`[${cron}] Running for categories: ${categories.join(", ")} at ${date} ${timeSlot}`);

  // Log the run start
  const runStartTime = Date.now();

  for (const category of categories) {
    try {
      await processCategory(env, category, date, timeSlot);
      await logRun(env, category, timeSlot, "success", Date.now() - runStartTime);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[${category}] Error: ${errorMsg}`);
      await logRun(env, category, timeSlot, "error", Date.now() - runStartTime, errorMsg);
    }
  }
}

async function processCategory(
  env: Env,
  category: Category,
  date: string,
  timeSlot: string
): Promise<void> {
  console.log(`[${category}] Processing signals for ${date} ${timeSlot}`);

  // TODO: Implement signal generation pipeline
  // 1. Fetch macro data (DXY, VIX, 10Y yields) - use Alpha Vantage
  // 2. Save/update macro_signals table
  // 3. Fetch asset data:
  //    - Crypto: Binance API (price, funding rate)
  //    - Forex/Stocks: Twelve Data (price, RSI)
  // 4. Calculate bias using rule engine:
  //    - Price vs 20D MA
  //    - Secondary indicator (funding rate / RSI / relative strength)
  //    - 2 bullish = Bullish, 2 bearish = Bearish, else Neutral
  // 5. Generate LLM summary:
  //    - Crypto/Forex: Workers AI (Llama 3.1 8B)
  //    - Stocks: DeepSeek V3 via OpenRouter
  // 6. Save to signals + asset_signals tables
  // 7. Post to Telegram channel

  console.log(`[${category}] Signal generation not yet implemented`);
}

async function logRun(
  env: Env,
  category: Category,
  timeSlot: string,
  status: "success" | "error",
  durationMs: number,
  errorMsg?: string
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO run_logs (category, time_slot, run_at, status, duration_ms, error_msg)
       VALUES (?, ?, datetime('now'), ?, ?, ?)`
    )
      .bind(category, timeSlot, status, durationMs, errorMsg ?? null)
      .run();
  } catch (e) {
    console.error("Failed to log run:", e);
  }
}
