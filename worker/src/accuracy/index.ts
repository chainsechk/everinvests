// Accuracy tracking - checks yesterday's signals against current prices
// Runs daily at 01:00 UTC

import type { Env } from "../env";
import type { Category, Bias } from "../types";

interface SignalToCheck {
  id: number;
  category: Category;
  date: string;
  bias: Bias;
  data_json: string;
}

interface AssetPrice {
  ticker: string;
  price: number;
}

interface SignalPriceData {
  price?: number;
  avgPrice?: number;
  assets?: Array<{ ticker: string; price: number }>;
}

// Fetch current price for crypto using CoinGecko simple/price endpoint
async function fetchCryptoPrice(): Promise<number> {
  const url = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd";
  const res = await fetch(url, {
    headers: {
      "User-Agent": "EverInvests/1.0",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`CoinGecko price failed: ${res.status}`);
  }

  const data = (await res.json()) as { bitcoin: { usd: number }; ethereum: { usd: number } };
  // Return average of BTC and ETH for category-level comparison
  return (data.bitcoin.usd + data.ethereum.usd) / 2;
}

// Fetch current prices for forex/stocks using TwelveData quote endpoint
async function fetchTwelveDataPrices(
  tickers: string[],
  apiKey: string
): Promise<AssetPrice[]> {
  const results: AssetPrice[] = [];

  for (const ticker of tickers) {
    try {
      const url = `https://api.twelvedata.com/quote?symbol=${ticker}&apikey=${apiKey}`;
      const res = await fetch(url);

      if (!res.ok) continue;

      const data = (await res.json()) as { close?: string; status?: string };
      if (data.status === "error" || !data.close) continue;

      results.push({ ticker, price: parseFloat(data.close) });

      // Rate limit delay
      await new Promise((r) => setTimeout(r, 1000));
    } catch {
      console.warn(`Failed to fetch price for ${ticker}`);
    }
  }

  return results;
}

// Get representative tickers for each category
function getCategoryTickers(category: Category): string[] {
  switch (category) {
    case "crypto":
      return ["BTC", "ETH"];
    case "forex":
      return ["USD/JPY", "EUR/USD"];
    case "stocks":
      return ["NVDA", "AMD", "MSFT", "AAPL"];
  }
}

// Calculate average price from the signal's stored data
function getSignalPrice(signal: SignalToCheck): number | null {
  try {
    const data = JSON.parse(signal.data_json) as SignalPriceData;

    // Category-level signals may have avgPrice or individual asset prices
    if (typeof data.price === "number") {
      return data.price;
    }

    if (typeof data.avgPrice === "number") {
      return data.avgPrice;
    }

    // Calculate from assets if available
    if (Array.isArray(data.assets) && data.assets.length > 0) {
      const prices = data.assets
        .map((a) => a.price)
        .filter((p): p is number => typeof p === "number" && p > 0);
      if (prices.length > 0) {
        return prices.reduce((sum, p) => sum + p, 0) / prices.length;
      }
    }

    return null;
  } catch {
    return null;
  }
}

// Check if the signal prediction was correct
function isCorrect(predictedBias: Bias, priceChange: number): boolean {
  if (predictedBias === "Neutral") {
    // Neutral is correct if price moved less than 1%
    return Math.abs(priceChange) < 1;
  }
  if (predictedBias === "Bullish") {
    return priceChange > 0;
  }
  if (predictedBias === "Bearish") {
    return priceChange < 0;
  }
  return false;
}

export async function checkSignalAccuracy(env: Env): Promise<void> {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  console.log(`[Accuracy] Checking signals for ${yesterday}`);

  // Get all signals from yesterday that haven't been checked yet
  const signals = await env.DB.prepare(
    `SELECT s.id, s.category, s.date, s.bias, s.data_json
     FROM signals s
     LEFT JOIN signal_outcomes o ON s.id = o.signal_id
     WHERE s.date = ? AND o.id IS NULL`
  )
    .bind(yesterday)
    .all<SignalToCheck>();

  if (!signals.results || signals.results.length === 0) {
    console.log(`[Accuracy] No unchecked signals for ${yesterday}`);
    return;
  }

  console.log(`[Accuracy] Found ${signals.results.length} signals to check`);

  // Group signals by category to minimize API calls
  const signalsByCategory = new Map<Category, SignalToCheck[]>();
  for (const signal of signals.results) {
    const list = signalsByCategory.get(signal.category) || [];
    list.push(signal);
    signalsByCategory.set(signal.category, list);
  }

  // Fetch current prices and check each category
  for (const [category, categorySignals] of signalsByCategory) {
    try {
      let currentAvgPrice: number;

      if (category === "crypto") {
        currentAvgPrice = await fetchCryptoPrice();
      } else {
        const tickers = getCategoryTickers(category);
        const prices = await fetchTwelveDataPrices(
          tickers,
          env.TWELVEDATA_API_KEY || ""
        );

        if (prices.length === 0) {
          console.warn(`[Accuracy] No prices for ${category}`);
          continue;
        }

        currentAvgPrice =
          prices.reduce((sum, p) => sum + p.price, 0) / prices.length;
      }

      // Check each signal in this category
      for (const signal of categorySignals) {
        const priceAtSignal = getSignalPrice(signal);

        if (!priceAtSignal) {
          console.warn(
            `[Accuracy] Could not extract price from signal ${signal.id}`
          );
          continue;
        }

        const priceChange =
          ((currentAvgPrice - priceAtSignal) / priceAtSignal) * 100;
        const correct = isCorrect(signal.bias, priceChange);

        await env.DB.prepare(
          `INSERT INTO signal_outcomes
           (signal_id, category, predicted_bias, price_at_signal, price_after_24h, price_change_pct, correct, checked_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        )
          .bind(
            signal.id,
            signal.category,
            signal.bias,
            priceAtSignal,
            currentAvgPrice,
            priceChange,
            correct ? 1 : 0
          )
          .run();

        console.log(
          `[Accuracy] ${signal.category} signal ${signal.id}: ${signal.bias} -> ${priceChange.toFixed(2)}% = ${correct ? "CORRECT" : "WRONG"}`
        );
      }

      // Rate limit between categories
      await new Promise((r) => setTimeout(r, 2000));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[Accuracy] Failed to check ${category}: ${msg}`);
    }
  }
}

// Get accuracy statistics for a category
export async function getAccuracyStats(
  db: D1Database,
  category: Category,
  days: number = 30
): Promise<{
  total: number;
  correct: number;
  rate: number;
  byBias: Record<Bias, { total: number; correct: number; rate: number }>;
}> {
  type D1Database = import("@cloudflare/workers-types").D1Database;

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const results = await db
    .prepare(
      `SELECT predicted_bias, COUNT(*) as total, SUM(correct) as correct
       FROM signal_outcomes
       WHERE category = ? AND checked_at >= ?
       GROUP BY predicted_bias`
    )
    .bind(category, cutoff)
    .all<{ predicted_bias: Bias; total: number; correct: number }>();

  let total = 0;
  let correct = 0;
  const byBias: Record<Bias, { total: number; correct: number; rate: number }> =
    {
      Bullish: { total: 0, correct: 0, rate: 0 },
      Bearish: { total: 0, correct: 0, rate: 0 },
      Neutral: { total: 0, correct: 0, rate: 0 },
    };

  for (const row of results.results || []) {
    total += row.total;
    correct += row.correct;
    byBias[row.predicted_bias] = {
      total: row.total,
      correct: row.correct,
      rate: row.total > 0 ? (row.correct / row.total) * 100 : 0,
    };
  }

  return {
    total,
    correct,
    rate: total > 0 ? (correct / total) * 100 : 0,
    byBias,
  };
}
