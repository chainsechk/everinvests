// src/pages/api/meta/schedule.ts
// Server-side schedule API for signal update times

import type { APIContext } from "astro";

interface ScheduleEntry {
  category: string;
  label: string;
  assets: string;
  times: string[];
  weekdaysOnly: boolean;
  timezone: string;
}

interface NextUpdate {
  category: string;
  nextAt: string;
  inMinutes: number;
}

const SCHEDULE: ScheduleEntry[] = [
  {
    category: "crypto",
    label: "Crypto",
    assets: "BTC, ETH",
    times: ["00:00", "08:00", "16:00"],
    weekdaysOnly: false,
    timezone: "UTC",
  },
  {
    category: "forex",
    label: "Forex",
    assets: "USD/JPY, EUR/USD, USD/CAD, AUD/USD",
    times: ["00:00", "08:00", "14:00"],
    weekdaysOnly: true,
    timezone: "UTC",
  },
  {
    category: "stocks",
    label: "Stocks",
    assets: "25 tickers (tech, energy)",
    times: ["17:00", "21:00"],
    weekdaysOnly: true,
    timezone: "UTC",
  },
];

function getNextUpdates(): NextUpdate[] {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  const dayOfWeek = now.getUTCDay();
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
  const currentMinutes = utcHour * 60 + utcMinute;

  const results: NextUpdate[] = [];

  for (const entry of SCHEDULE) {
    // Skip weekday-only categories on weekends
    if (entry.weekdaysOnly && !isWeekday) {
      // Find next weekday update
      const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 6 ? 2 : 0;
      if (daysUntilMonday > 0) {
        const nextTime = entry.times[0]; // First update on Monday
        const [h, m] = nextTime.split(":").map(Number);
        const nextMinutes = daysUntilMonday * 24 * 60 + h * 60 + m - currentMinutes;
        results.push({
          category: entry.category,
          nextAt: `${nextTime} UTC (Mon)`,
          inMinutes: nextMinutes,
        });
        continue;
      }
    }

    // Find next update time today
    let nextTime: string | null = null;
    let nextMinutes = Infinity;

    for (const time of entry.times) {
      const [h, m] = time.split(":").map(Number);
      const timeMinutes = h * 60 + m;

      if (timeMinutes > currentMinutes) {
        const diff = timeMinutes - currentMinutes;
        if (diff < nextMinutes) {
          nextMinutes = diff;
          nextTime = time;
        }
      }
    }

    // If no update remaining today, get first update tomorrow
    if (!nextTime) {
      // Check if tomorrow is a valid day for this category
      const tomorrowIsWeekday = dayOfWeek >= 0 && dayOfWeek <= 4; // Sun-Thu means Mon-Fri tomorrow

      if (entry.weekdaysOnly && !tomorrowIsWeekday) {
        // Skip to Monday
        const daysUntilMonday = dayOfWeek === 5 ? 2 : 1; // Sat->2, Sun->1
        const firstTime = entry.times[0];
        const [h, m] = firstTime.split(":").map(Number);
        nextMinutes = daysUntilMonday * 24 * 60 + h * 60 + m - currentMinutes + 24 * 60;
        nextTime = `${firstTime} (Mon)`;
      } else {
        // Tomorrow
        nextTime = entry.times[0];
        const [h, m] = nextTime.split(":").map(Number);
        nextMinutes = 24 * 60 - currentMinutes + h * 60 + m;
        nextTime = `${nextTime} (tomorrow)`;
      }
    }

    results.push({
      category: entry.category,
      nextAt: `${nextTime} UTC`,
      inMinutes: nextMinutes,
    });
  }

  return results.sort((a, b) => a.inMinutes - b.inMinutes);
}

export async function GET(context: APIContext) {
  const nextUpdates = getNextUpdates();
  const now = new Date();

  return Response.json({
    schedule: SCHEDULE,
    nextUpdates,
    currentTime: now.toISOString(),
    timezone: "UTC",
  }, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60", // 1 min cache
    },
  });
}
