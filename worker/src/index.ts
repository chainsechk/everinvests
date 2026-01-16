import type { Category } from "./types";
import type { Env } from "./env";
import { getWorkflow } from "./workflows";
import { createD1Recorder, runWorkflow } from "./pipeline";
import { skillRegistry } from "./skills";
import { logRun } from "./storage/d1";

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
    ctx.waitUntil(runScheduledJob(env, event.cron));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("ok");
    }

    if (url.pathname === "/trigger") {
      const category = url.searchParams.get("category") as Category | null;
      await runScheduledJob(env, "manual", category ? [category] : undefined);
      return Response.json({ triggered: true, category: category ?? "all scheduled" });
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
