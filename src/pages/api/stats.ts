import type { APIContext } from "astro";

interface StatsRow {
  count: number;
}

interface AccuracyRow {
  rate: number | null;
}

export async function GET(context: APIContext) {
  const db = context.locals.runtime?.env?.DB;
  if (!db) {
    return Response.json(
      { error: "database not configured" },
      { status: 500 }
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const [signals, accuracy, signalsToday, categories] = await Promise.all([
    // Total signals generated
    db.prepare("SELECT COUNT(*) as count FROM signals").first<StatsRow>(),

    // 30-day accuracy rate
    db
      .prepare(
        `SELECT AVG(correct) * 100 as rate
         FROM signal_outcomes
         WHERE checked_at >= ?`
      )
      .bind(thirtyDaysAgo)
      .first<AccuracyRow>(),

    // Signals generated today
    db
      .prepare("SELECT COUNT(*) as count FROM signals WHERE date = ?")
      .bind(today)
      .first<StatsRow>(),

    // Signals per category (last 30 days)
    db
      .prepare(
        `SELECT category, COUNT(*) as count
         FROM signals
         WHERE date >= ?
         GROUP BY category`
      )
      .bind(thirtyDaysAgo)
      .all<{ category: string; count: number }>(),
  ]);

  const categoryBreakdown: Record<string, number> = {};
  for (const row of categories.results || []) {
    categoryBreakdown[row.category] = row.count;
  }

  return Response.json({
    totalSignals: signals?.count ?? 0,
    accuracyRate: accuracy?.rate ? Math.round(accuracy.rate) : null,
    signalsToday: signalsToday?.count ?? 0,
    last30Days: {
      byCategory: categoryBreakdown,
    },
    generatedAt: new Date().toISOString(),
  });
}
