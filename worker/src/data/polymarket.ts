/**
 * Polymarket Prediction Market Integration
 *
 * Fetches prediction market data from the Gamma API for regime detection.
 * Free API, no auth required. Rate limit: 1,000 calls/hour.
 *
 * Runs every 6 hours alongside GDELT (01:00, 07:00, 13:00, 19:00 UTC).
 */

import type { PolymarketData, PolymarketTopMarket } from "../types";

// Gamma API endpoint (read-only, no auth)
const GAMMA_API = "https://gamma-api.polymarket.com/markets";

// Keywords to filter relevant markets
const CRYPTO_KEYWORDS = ["btc", "bitcoin", "eth", "ethereum", "crypto"];
const FED_KEYWORDS = ["fomc", "fed", "rate", "powell", "interest"];
const ECONOMY_KEYWORDS = ["recession", "gdp", "inflation", "unemployment", "economy"];
const GEOPOLITICAL_KEYWORDS = ["election", "tariff", "war", "sanction", "china", "russia"];

interface GammaMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  active: boolean;
  closed: boolean;
  acceptingOrders: boolean;
  enableOrderBook: boolean;
  outcomePrices: string;  // JSON string of prices array
  volume: string;         // 24h volume in USDC
  liquidity: string;
  endDate: string;
  description: string;
  outcomes: string;       // JSON string of outcomes array
}

interface GammaApiResponse {
  data?: GammaMarket[];
  next_cursor?: string;
}

/**
 * Categorize a market based on its question text
 */
function categorizeMarket(question: string): "crypto" | "fed" | "economy" | "geopolitical" | null {
  const lower = question.toLowerCase();

  if (CRYPTO_KEYWORDS.some(kw => lower.includes(kw))) return "crypto";
  if (FED_KEYWORDS.some(kw => lower.includes(kw))) return "fed";
  if (ECONOMY_KEYWORDS.some(kw => lower.includes(kw))) return "economy";
  if (GEOPOLITICAL_KEYWORDS.some(kw => lower.includes(kw))) return "geopolitical";

  return null;
}

/**
 * Determine if a market is bullish/positive based on question framing
 * Returns true if "Yes" outcome represents a bullish/positive view
 */
function isBullishFrame(question: string, category: "crypto" | "fed" | "economy" | "geopolitical"): boolean {
  const lower = question.toLowerCase();

  switch (category) {
    case "crypto":
      // "BTC above X" → Yes is bullish
      // "BTC below X" → Yes is bearish
      return lower.includes("above") || lower.includes("higher") || lower.includes("reach");

    case "fed":
      // "Fed cut rates" → Yes is dovish (bullish for risk)
      // "Fed raise rates" → Yes is hawkish (bearish)
      return lower.includes("cut") || lower.includes("lower") || lower.includes("pause");

    case "economy":
      // "Recession" → Yes is bearish
      // "GDP growth" → Yes is bullish
      return !lower.includes("recession") && (lower.includes("growth") || lower.includes("improve"));

    case "geopolitical":
      // Most geopolitical "Yes" outcomes are risk events
      return false;
  }
}

/**
 * Parse outcome prices from Gamma API format
 * Returns [yesPrice, noPrice] as 0-1 decimals
 */
function parseOutcomePrices(pricesJson: string): [number, number] {
  try {
    const prices = JSON.parse(pricesJson);
    // Format: ["0.72", "0.28"] where first is Yes, second is No
    if (Array.isArray(prices) && prices.length >= 2) {
      return [parseFloat(prices[0]) || 0.5, parseFloat(prices[1]) || 0.5];
    }
  } catch {
    // Ignore parse errors
  }
  return [0.5, 0.5];
}

/**
 * Fetch prediction market data from Polymarket's Gamma API
 */
export async function fetchPolymarketData(): Promise<PolymarketData> {
  const now = new Date();
  const fetchedAt = now.toISOString();

  // Default fallback if API fails
  const fallback: PolymarketData = {
    cryptoBullish: 50,
    fedDovish: 50,
    recessionOdds: 30,
    avgVolatility: 50,
    topMarkets: [],
    marketsCount: 0,
    fetchedAt,
  };

  try {
    // Fetch active markets sorted by volume
    const params = new URLSearchParams({
      active: "true",
      closed: "false",
      limit: "100",
      order: "volume",
      ascending: "false",
    });

    const response = await fetch(`${GAMMA_API}?${params}`, {
      headers: {
        "User-Agent": "EverInvests/1.0 (prediction-market-monitor)",
      },
    });

    if (!response.ok) {
      console.error(`[Polymarket] API error: ${response.status}`);
      return fallback;
    }

    // Gamma API returns array directly, not wrapped in data
    const markets = (await response.json()) as GammaMarket[];

    if (!Array.isArray(markets) || markets.length === 0) {
      console.log("[Polymarket] No markets returned");
      return fallback;
    }

    // Categorize and filter relevant markets
    const categorized: Array<{
      market: GammaMarket;
      category: "crypto" | "fed" | "economy" | "geopolitical";
      yesProbability: number;
      volume: number;
      isBullish: boolean;
    }> = [];

    for (const market of markets) {
      const category = categorizeMarket(market.question);
      if (!category) continue;

      const [yesPrice] = parseOutcomePrices(market.outcomePrices);
      const volume = parseFloat(market.volume) || 0;
      const isBullish = isBullishFrame(market.question, category);

      categorized.push({
        market,
        category,
        yesProbability: yesPrice * 100,
        volume,
        isBullish,
      });
    }

    if (categorized.length === 0) {
      console.log("[Polymarket] No relevant markets found");
      return fallback;
    }

    // Calculate aggregates by category
    const byCategory = {
      crypto: categorized.filter(m => m.category === "crypto"),
      fed: categorized.filter(m => m.category === "fed"),
      economy: categorized.filter(m => m.category === "economy"),
      geopolitical: categorized.filter(m => m.category === "geopolitical"),
    };

    // Crypto bullishness: weighted average of bullish-framed markets
    let cryptoBullish = 50;
    if (byCategory.crypto.length > 0) {
      const bullishMarkets = byCategory.crypto.filter(m => m.isBullish);
      const bearishMarkets = byCategory.crypto.filter(m => !m.isBullish);

      const bullishAvg = bullishMarkets.length > 0
        ? bullishMarkets.reduce((sum, m) => sum + m.yesProbability, 0) / bullishMarkets.length
        : 50;
      const bearishAvg = bearishMarkets.length > 0
        ? bearishMarkets.reduce((sum, m) => sum + m.yesProbability, 0) / bearishMarkets.length
        : 50;

      // Combine: high bullish + low bearish = bullish
      cryptoBullish = (bullishAvg + (100 - bearishAvg)) / 2;
    }

    // Fed dovishness: probability of rate cuts/pauses
    let fedDovish = 50;
    if (byCategory.fed.length > 0) {
      const dovishMarkets = byCategory.fed.filter(m => m.isBullish);
      if (dovishMarkets.length > 0) {
        fedDovish = dovishMarkets.reduce((sum, m) => sum + m.yesProbability, 0) / dovishMarkets.length;
      }
    }

    // Recession odds: average of recession-related markets
    let recessionOdds = 30;
    const recessionMarkets = byCategory.economy.filter(m =>
      m.market.question.toLowerCase().includes("recession")
    );
    if (recessionMarkets.length > 0) {
      recessionOdds = recessionMarkets.reduce((sum, m) => sum + m.yesProbability, 0) / recessionMarkets.length;
    }

    // Average volatility: how close markets are to 50/50 (uncertain)
    // Markets at 50% = high uncertainty, at 90% or 10% = low uncertainty
    const allProbabilities = categorized.map(m => m.yesProbability);
    const avgVolatility = allProbabilities.reduce((sum, p) => {
      // Distance from certainty: 50% = max uncertainty (100), 0%/100% = min uncertainty (0)
      return sum + (50 - Math.abs(p - 50));
    }, 0) / allProbabilities.length;

    // Top 3 markets by volume (excluding geopolitical to avoid local/regional markets)
    const topMarkets: PolymarketTopMarket[] = categorized
      .filter(m => m.category !== 'geopolitical')
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 3)
      .map(m => ({
        question: m.market.question,
        probability: Math.round(m.yesProbability),
        category: m.category,
        volume: m.volume,
      }));

    console.log(
      `[Polymarket] Found ${categorized.length} relevant markets: ` +
      `crypto=${byCategory.crypto.length}, fed=${byCategory.fed.length}, ` +
      `economy=${byCategory.economy.length}, geo=${byCategory.geopolitical.length}`
    );

    return {
      cryptoBullish: Math.round(cryptoBullish),
      fedDovish: Math.round(fedDovish),
      recessionOdds: Math.round(recessionOdds),
      avgVolatility: Math.round(avgVolatility * 2),  // Scale to 0-100
      topMarkets,
      marketsCount: categorized.length,
      fetchedAt,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Polymarket] Fetch error: ${msg}`);
    return fallback;
  }
}
