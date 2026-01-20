// Daily digest - aggregates all signals and sends a summary
import type { Env } from "../env";
import type { Bias, Category } from "../types";
import { sendTelegramMessage } from "../notify/telegram";

type D1Database = import("@cloudflare/workers-types").D1Database;

interface DaySignal {
  category: Category;
  time_slot: string;
  bias: Bias;
  summary: string | null;
}

interface DailyDigestData {
  date: string;
  signals: DaySignal[];
  categorySummary: Record<Category, { signals: number; bullish: number; bearish: number; neutral: number }>;
  marketMood: "bullish" | "bearish" | "mixed";
}

async function getDailySignals(db: D1Database, date: string): Promise<DaySignal[]> {
  const { results } = await db
    .prepare(
      `SELECT category, time_slot, bias, output_json
       FROM signals
       WHERE date = ?
       ORDER BY time_slot ASC`
    )
    .bind(date)
    .all<{ category: Category; time_slot: string; bias: Bias; output_json: string | null }>();

  return (results ?? []).map((r) => {
    let summary: string | null = null;
    if (r.output_json) {
      try {
        const output = JSON.parse(r.output_json);
        summary = output.summary || null;
      } catch {
        // Ignore
      }
    }
    return {
      category: r.category,
      time_slot: r.time_slot,
      bias: r.bias,
      summary,
    };
  });
}

function computeCategorySummary(signals: DaySignal[]): DailyDigestData["categorySummary"] {
  const summary: DailyDigestData["categorySummary"] = {
    crypto: { signals: 0, bullish: 0, bearish: 0, neutral: 0 },
    forex: { signals: 0, bullish: 0, bearish: 0, neutral: 0 },
    stocks: { signals: 0, bullish: 0, bearish: 0, neutral: 0 },
  };

  for (const signal of signals) {
    summary[signal.category].signals++;
    if (signal.bias === "Bullish") summary[signal.category].bullish++;
    else if (signal.bias === "Bearish") summary[signal.category].bearish++;
    else summary[signal.category].neutral++;
  }

  return summary;
}

function determineMarketMood(summary: DailyDigestData["categorySummary"]): "bullish" | "bearish" | "mixed" {
  let totalBullish = 0;
  let totalBearish = 0;
  let totalSignals = 0;

  for (const cat of Object.values(summary)) {
    totalBullish += cat.bullish;
    totalBearish += cat.bearish;
    totalSignals += cat.signals;
  }

  if (totalSignals === 0) return "mixed";

  const bullishRatio = totalBullish / totalSignals;
  const bearishRatio = totalBearish / totalSignals;

  if (bullishRatio > 0.6) return "bullish";
  if (bearishRatio > 0.6) return "bearish";
  return "mixed";
}

function formatDigestMessage(data: DailyDigestData, siteUrl: string): string {
  const moodEmoji = data.marketMood === "bullish" ? "🟢" : data.marketMood === "bearish" ? "🔴" : "🟡";
  const moodText = data.marketMood.charAt(0).toUpperCase() + data.marketMood.slice(1);

  let message = `${moodEmoji} <b>Daily Market Digest</b>\n`;
  message += `📅 ${data.date}\n\n`;
  message += `<b>Overall Market Mood:</b> ${moodText}\n\n`;

  const categoryEmoji: Record<Category, string> = {
    crypto: "₿",
    forex: "💱",
    stocks: "📈",
  };

  for (const [cat, stats] of Object.entries(data.categorySummary) as [Category, (typeof data.categorySummary)[Category]][]) {
    if (stats.signals === 0) continue;

    const dominant =
      stats.bullish > stats.bearish && stats.bullish > stats.neutral
        ? "Bullish"
        : stats.bearish > stats.bullish && stats.bearish > stats.neutral
          ? "Bearish"
          : "Mixed";
    const dominantEmoji = dominant === "Bullish" ? "🟢" : dominant === "Bearish" ? "🔴" : "🟡";

    message += `${categoryEmoji[cat]} <b>${cat.charAt(0).toUpperCase() + cat.slice(1)}:</b> ${dominantEmoji} ${dominant}\n`;
    message += `   ${stats.bullish} bullish | ${stats.bearish} bearish | ${stats.neutral} neutral\n\n`;
  }

  // Add the last summary for each category
  const categoryOrder: Category[] = ["crypto", "forex", "stocks"];
  for (const cat of categoryOrder) {
    const lastSignal = data.signals.filter((s) => s.category === cat).pop();
    if (lastSignal?.summary) {
      message += `<i>${cat.charAt(0).toUpperCase() + cat.slice(1)}:</i> ${lastSignal.summary}\n\n`;
    }
  }

  // Link with UTM
  const baseUrl = siteUrl.replace(/\/$/, "");
  const url = new URL("/", baseUrl);
  url.searchParams.set("utm_source", "telegram");
  url.searchParams.set("utm_medium", "digest");
  url.searchParams.set("utm_campaign", "daily_digest");

  message += `🔗 <a href="${url.href}">View All Signals</a>`;

  return message;
}

export async function sendDailyDigest(env: Env): Promise<boolean> {
  // Get yesterday's date (digest is sent after the trading day ends)
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const date = yesterday.toISOString().split("T")[0];

  console.log(`[DailyDigest] Generating digest for ${date}`);

  const signals = await getDailySignals(env.DB, date);

  if (signals.length === 0) {
    console.log(`[DailyDigest] No signals for ${date}, skipping digest`);
    return false;
  }

  const categorySummary = computeCategorySummary(signals);
  const marketMood = determineMarketMood(categorySummary);

  const digestData: DailyDigestData = {
    date,
    signals,
    categorySummary,
    marketMood,
  };

  const message = formatDigestMessage(digestData, env.SITE_URL ?? "https://everinvests.com");

  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    console.log("[DailyDigest] Telegram not configured, skipping send");
    return false;
  }

  const success = await sendTelegramMessage(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID, message);

  if (success) {
    console.log(`[DailyDigest] Sent digest for ${date}`);
  } else {
    console.error(`[DailyDigest] Failed to send digest for ${date}`);
  }

  return success;
}
