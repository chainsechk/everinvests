import type { Category } from "./types";
import type { Env } from "./env";
import { getWorkflow } from "./workflows";
import { createD1Recorder, runWorkflow } from "./pipeline";
import { skillRegistry } from "./skills";
import { logRun, saveBenchmarkData, saveGdeltScore, getPreviousGdeltScore } from "./storage/d1";
import { checkSignalAccuracy } from "./accuracy";
import { generateWeeklyBlogPosts } from "./blog";
import { sendDailyDigest } from "./digest";
import { fetchBenchmarkData } from "./data/twelvedata";
import { fetchGdeltScore } from "./data/gdelt";

// Schedule configuration (UTC hours)
const SCHEDULE: Record<Category, { hours: number[]; weekdaysOnly: boolean }> = {
  crypto: { hours: [0, 8, 16], weekdaysOnly: false },
  forex: { hours: [0, 8, 14], weekdaysOnly: true },
  stocks: { hours: [17, 21], weekdaysOnly: true },
};

function getCategoriesToRun(utcHour: number, dayOfWeek: number): Category[] {
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const categories: Category[] = [];

  for (const [category, config] of Object.entries(SCHEDULE) as [
    Category,
    (typeof SCHEDULE)[Category],
  ][]) {
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
    const now = new Date();
    const utcHour = now.getUTCHours();

    // Run accuracy check at 01:00 UTC (checks yesterday's signals)
    if (utcHour === 1) {
      ctx.waitUntil(
        checkSignalAccuracy(env).catch((err) =>
          console.error("[Accuracy] Check failed:", err)
        )
      );

      // Fetch GDELT geopolitical score daily at 01:00 UTC (Phase 4 Regime)
      ctx.waitUntil(
        runGdeltFetch(env).catch((err) =>
          console.error("[GDELT] Fetch failed:", err)
        )
      );
    }

    // Run daily digest at 23:00 UTC
    const dayOfWeek = now.getUTCDay();
    if (utcHour === 23) {
      ctx.waitUntil(
        sendDailyDigest(env).catch((err) =>
          console.error("[DailyDigest] Send failed:", err)
        )
      );
    }

    // Run weekly blog generation on Sundays at 23:00 UTC
    if (dayOfWeek === 0 && utcHour === 23) {
      ctx.waitUntil(
        generateWeeklyBlogPosts(env).catch((err) =>
          console.error("[WeeklyBlog] Generation failed:", err)
        )
      );
    }

    // Run benchmark fetch at 14:00 UTC on weekdays (before stocks at 17:00)
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    if (utcHour === 14 && isWeekday) {
      ctx.waitUntil(
        runBenchmarkFetch(env).catch((err) =>
          console.error("[Benchmarks] Fetch failed:", err)
        )
      );
    }

    ctx.waitUntil(runScheduledJob(env, event.cron));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check (public)
    if (url.pathname === "/health") {
      return new Response("ok");
    }

    // Admin routes require authentication
    const adminRoutes = [
      "/trigger",
      "/check-accuracy",
      "/generate-weekly-blog",
      "/send-daily-digest",
      "/fetch-benchmarks",
      "/fetch-gdelt",
    ];

    if (adminRoutes.includes(url.pathname)) {
      // Verify bearer token
      const authHeader = request.headers.get("Authorization");
      const token = authHeader?.replace("Bearer ", "");

      if (!env.WORKER_AUTH_TOKEN) {
        console.error("[Auth] WORKER_AUTH_TOKEN not configured");
        return Response.json(
          { error: "Server misconfiguration" },
          { status: 500 }
        );
      }

      if (!token || token !== env.WORKER_AUTH_TOKEN) {
        return Response.json(
          { error: "Unauthorized" },
          { status: 401, headers: { "WWW-Authenticate": "Bearer" } }
        );
      }
    }

    if (url.pathname === "/trigger") {
      const category = url.searchParams.get("category") as Category | null;
      await runScheduledJob(env, "manual", category ? [category] : undefined);
      return Response.json({ triggered: true, category: category ?? "all scheduled" });
    }

    if (url.pathname === "/check-accuracy") {
      await checkSignalAccuracy(env);
      return Response.json({ checked: true });
    }

    if (url.pathname === "/generate-weekly-blog") {
      await generateWeeklyBlogPosts(env);
      return Response.json({ generated: true });
    }

    if (url.pathname === "/send-daily-digest") {
      const sent = await sendDailyDigest(env);
      return Response.json({ sent });
    }

    if (url.pathname === "/fetch-benchmarks") {
      const result = await runBenchmarkFetch(env);
      return Response.json(result);
    }

    if (url.pathname === "/fetch-gdelt") {
      const result = await runGdeltFetch(env);
      return Response.json(result);
    }

    return new Response("everinvests-worker", { status: 200 });
  },
};

// Fetch and store GDELT geopolitical score (Phase 4 Regime Detection)
// Runs daily at 01:00 UTC
async function runGdeltFetch(env: Env): Promise<{
  success: boolean;
  score: number;
  trend: string;
  topThreats: string[];
}> {
  const now = new Date();
  const date = now.toISOString().split("T")[0];

  console.log(`[GDELT] Fetching geopolitical score for ${date}...`);

  try {
    // Get previous score for trend calculation
    const previousScore = await getPreviousGdeltScore({ db: env.DB });

    // Fetch new score from GDELT
    const result = await fetchGdeltScore(previousScore);

    // Store in database
    await saveGdeltScore({ db: env.DB, date, result });

    console.log(
      `[GDELT] Score: ${result.score}, Trend: ${result.trend}, Articles: ${result.articles}, Top: ${result.topThreats.join(", ")}`
    );

    return {
      success: true,
      score: result.score,
      trend: result.trend,
      topThreats: result.topThreats,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[GDELT] Error: ${msg}`);
    return {
      success: false,
      score: 0,
      trend: "stable",
      topThreats: [],
    };
  }
}

// Fetch and store benchmark ETF data (SPY, XLK, XLE)
// Runs daily at 14:00 UTC, before stocks update at 17:00
async function runBenchmarkFetch(env: Env): Promise<{
  success: boolean;
  benchmarks: { spy: boolean; xlk: boolean; xle: boolean };
}> {
  const apiKey = env.TWELVEDATA_API_KEY;
  if (!apiKey) {
    console.error("[Benchmarks] Missing TWELVEDATA_API_KEY");
    return { success: false, benchmarks: { spy: false, xlk: false, xle: false } };
  }

  const now = new Date();
  const date = now.toISOString().split("T")[0];

  console.log(`[Benchmarks] Fetching SPY, XLK, XLE for ${date}...`);

  try {
    const result = await fetchBenchmarkData(apiKey);

    const saved = { spy: false, xlk: false, xle: false };

    for (const ticker of ["SPY", "XLK", "XLE"] as const) {
      const key = ticker.toLowerCase() as "spy" | "xlk" | "xle";
      const data = result[key];
      if (data) {
        await saveBenchmarkData({
          db: env.DB,
          ticker,
          date,
          price: data.price,
          ma20: data.ma20,
          fetchedAt: result.fetchedAt,
        });
        saved[key] = true;
        console.log(`[Benchmarks] Saved ${ticker}: price=${data.price.toFixed(2)}, ma20=${data.ma20.toFixed(2)}`);
      }
    }

    console.log(`[Benchmarks] Complete: SPY=${saved.spy}, XLK=${saved.xlk}, XLE=${saved.xle}`);
    return { success: true, benchmarks: saved };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Benchmarks] Error: ${msg}`);
    return { success: false, benchmarks: { spy: false, xlk: false, xle: false } };
  }
}

async function runScheduledJob(
  env: Env,
  cron: string,
  forceCategories?: Category[]
): Promise<void> {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const dayOfWeek = now.getUTCDay();
  const date = now.toISOString().split("T")[0];
  const timeSlot = formatTimeSlot(utcHour);

  const categories = forceCategories ?? getCategoriesToRun(utcHour, dayOfWeek);

  if (categories.length === 0) {
    console.log(`[${cron}] No categories scheduled for hour ${utcHour}`);
    return;
  }

  console.log(
    `[${cron}] Running workflows: ${categories.join(", ")} at ${date} ${timeSlot}`
  );

  const recorder = createD1Recorder(env);
  const shared: Record<string, unknown> = {};

  for (const category of categories) {
    const runStartTime = Date.now();
    try {
      await runWorkflow({
        env,
        ctx: { cron, category, date, timeSlot },
        workflow: getWorkflow(category),
        skills: skillRegistry,
        shared,
        recorder,
      });

      await logRun({
        db: env.DB,
        category,
        timeSlot,
        status: "success",
        durationMs: Date.now() - runStartTime,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[${category}] Error: ${errorMsg}`);
      await logRun({
        db: env.DB,
        category,
        timeSlot,
        status: "error",
        durationMs: Date.now() - runStartTime,
        errorMsg,
      });
    }
  }
}
