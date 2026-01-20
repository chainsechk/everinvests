import type { APIContext } from "astro";
import { normalizeCategory, type Category } from "../../../lib/db/types";

type Bias = "Bullish" | "Bearish" | "Neutral";

interface OutcomeRow {
  predicted_bias: Bias;
  total: number;
  correct: number;
}

interface RecentOutcome {
  date: string;
  bias: Bias;
  price_change_pct: number;
  correct: number;
}

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

  // Get days parameter (default 30)
  const url = new URL(context.request.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get("days") || "30"), 1), 365);

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  // Get aggregated stats by bias
  const stats = await db
    .prepare(
      `SELECT predicted_bias, COUNT(*) as total, SUM(correct) as correct
       FROM signal_outcomes
       WHERE category = ? AND checked_at >= ?
       GROUP BY predicted_bias`
    )
    .bind(category, cutoff)
    .all<OutcomeRow>();

  // Calculate totals
  let total = 0;
  let correct = 0;
  const byBias: Record<Bias, { total: number; correct: number; rate: number }> = {
    Bullish: { total: 0, correct: 0, rate: 0 },
    Bearish: { total: 0, correct: 0, rate: 0 },
    Neutral: { total: 0, correct: 0, rate: 0 },
  };

  for (const row of stats.results || []) {
    total += row.total;
    correct += row.correct;
    byBias[row.predicted_bias] = {
      total: row.total,
      correct: row.correct,
      rate: row.total > 0 ? Math.round((row.correct / row.total) * 100) : 0,
    };
  }

  // Get recent outcomes (last 10)
  const recent = await db
    .prepare(
      `SELECT s.date, o.predicted_bias as bias, o.price_change_pct, o.correct
       FROM signal_outcomes o
       JOIN signals s ON o.signal_id = s.id
       WHERE o.category = ?
       ORDER BY o.checked_at DESC
       LIMIT 10`
    )
    .bind(category)
    .all<RecentOutcome>();

  return Response.json({
    category,
    period: { days, since: cutoff },
    overall: {
      total,
      correct,
      rate: total > 0 ? Math.round((correct / total) * 100) : null,
    },
    byBias,
    recent: (recent.results || []).map((r) => ({
      date: r.date,
      bias: r.bias,
      priceChange: Math.round(r.price_change_pct * 100) / 100,
      correct: r.correct === 1,
    })),
  });
}
