// Free data sources for expanded macro indicators
// - Alternative.me: BTC Fear & Greed Index
// - CoinGecko: BTC Dominance
// - FRED: 2Y-10Y Treasury Spread

import { cachedFetch, DEFAULT_TTL } from "../cache";

// ============================================================================
// BTC Fear & Greed Index (Alternative.me)
// https://alternative.me/crypto/fear-and-greed-index/
// ============================================================================

interface FearGreedResponse {
  data: Array<{
    value: string;
    value_classification: string;
    timestamp: string;
  }>;
}

export interface FearGreedData {
  value: number; // 0-100
  classification: string; // "Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"
  cached: boolean;
}

export async function fetchFearGreed(): Promise<FearGreedData> {
  const url = "https://api.alternative.me/fng/?limit=1";

  try {
    const { data, cached } = await cachedFetch<FearGreedResponse>(
      url,
      DEFAULT_TTL.MACRO // 60 min cache
    );

    if (!data.data || data.data.length === 0) {
      console.warn("[FearGreed] No data returned");
      return { value: 50, classification: "Neutral", cached };
    }

    const latest = data.data[0];
    const value = parseInt(latest.value, 10);

    if (!Number.isFinite(value) || value < 0 || value > 100) {
      console.warn("[FearGreed] Invalid value:", latest.value);
      return { value: 50, classification: "Neutral", cached };
    }

    console.log(`[FearGreed] Value: ${value} (${latest.value_classification})`);
    return {
      value,
      classification: latest.value_classification,
      cached,
    };
  } catch (error) {
    console.error("[FearGreed] Fetch error:", error);
    return { value: 50, classification: "Neutral", cached: false };
  }
}

// ============================================================================
// BTC Dominance (CoinGecko)
// https://api.coingecko.com/api/v3/global
// ============================================================================

interface CoinGeckoGlobalResponse {
  data: {
    market_cap_percentage: {
      btc: number;
      eth: number;
    };
    total_market_cap: {
      usd: number;
    };
  };
}

export interface BTCDominanceData {
  dominance: number; // percentage, e.g., 52.5
  ethDominance: number;
  totalMarketCap: number;
  cached: boolean;
}

export async function fetchBTCDominance(): Promise<BTCDominanceData> {
  const url = "https://api.coingecko.com/api/v3/global";

  try {
    const { data, cached } = await cachedFetch<CoinGeckoGlobalResponse>(
      url,
      DEFAULT_TTL.MACRO, // 60 min cache
      {
        headers: {
          "User-Agent": "EverInvests/1.0",
          Accept: "application/json",
        },
      }
    );

    if (!data.data?.market_cap_percentage?.btc) {
      console.warn("[BTCDominance] No data returned");
      return { dominance: 50, ethDominance: 18, totalMarketCap: 0, cached };
    }

    const btcDom = data.data.market_cap_percentage.btc;
    const ethDom = data.data.market_cap_percentage.eth || 0;
    const totalMcap = data.data.total_market_cap?.usd || 0;

    console.log(`[BTCDominance] BTC: ${btcDom.toFixed(1)}%, ETH: ${ethDom.toFixed(1)}%`);
    return {
      dominance: btcDom,
      ethDominance: ethDom,
      totalMarketCap: totalMcap,
      cached,
    };
  } catch (error) {
    console.error("[BTCDominance] Fetch error:", error);
    return { dominance: 50, ethDominance: 18, totalMarketCap: 0, cached: false };
  }
}

// ============================================================================
// FRED: 2Y-10Y Treasury Spread (T10Y2Y)
// https://fred.stlouisfed.org/series/T10Y2Y
// Free API: https://api.stlouisfed.org/fred/series/observations
// ============================================================================

interface FREDObservationsResponse {
  observations: Array<{
    date: string;
    value: string;
  }>;
}

export interface TreasurySpreadData {
  spread: number; // in percentage points, e.g., -0.5 means inverted
  isInverted: boolean;
  cached: boolean;
}

export async function fetchTreasurySpread(fredApiKey: string): Promise<TreasurySpreadData> {
  // Get the most recent observation
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=T10Y2Y&sort_order=desc&limit=1&api_key=${fredApiKey}&file_type=json`;

  try {
    const { data, cached } = await cachedFetch<FREDObservationsResponse>(
      url,
      DEFAULT_TTL.MACRO // 60 min cache
    );

    if (!data.observations || data.observations.length === 0) {
      console.warn("[FRED] No T10Y2Y data returned");
      return { spread: 0, isInverted: false, cached };
    }

    const latest = data.observations[0];
    const spread = parseFloat(latest.value);

    if (!Number.isFinite(spread)) {
      console.warn("[FRED] Invalid spread value:", latest.value);
      return { spread: 0, isInverted: false, cached };
    }

    const isInverted = spread < 0;
    console.log(`[FRED] 2Y-10Y Spread: ${spread.toFixed(2)}% (${isInverted ? "INVERTED" : "normal"})`);

    return {
      spread,
      isInverted,
      cached,
    };
  } catch (error) {
    console.error("[FRED] Fetch error:", error);
    return { spread: 0, isInverted: false, cached: false };
  }
}

// ============================================================================
// Gold Price (via TwelveData - XAU/USD)
// Reuses existing TwelveData infrastructure
// ============================================================================

interface TwelveDataQuote {
  price: string;
  change: string;
  percent_change: string;
}

export interface GoldPriceData {
  price: number;
  change: number;
  changePercent: number;
  cached: boolean;
}

export async function fetchGoldPrice(twelveDataKey: string): Promise<GoldPriceData> {
  const url = `https://api.twelvedata.com/quote?symbol=XAU/USD&apikey=${twelveDataKey}`;

  try {
    const { data, cached } = await cachedFetch<TwelveDataQuote>(
      url,
      DEFAULT_TTL.TWELVEDATA_QUOTE // 5 min cache
    );

    if (!data.price) {
      console.warn("[Gold] No price data returned");
      return { price: 2000, change: 0, changePercent: 0, cached };
    }

    const price = parseFloat(data.price);
    const change = parseFloat(data.change) || 0;
    const changePercent = parseFloat(data.percent_change) || 0;

    if (!Number.isFinite(price) || price <= 0) {
      console.warn("[Gold] Invalid price:", data.price);
      return { price: 2000, change: 0, changePercent: 0, cached };
    }

    console.log(`[Gold] XAU/USD: $${price.toFixed(2)} (${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%)`);

    return {
      price,
      change,
      changePercent,
      cached,
    };
  } catch (error) {
    console.error("[Gold] Fetch error:", error);
    return { price: 2000, change: 0, changePercent: 0, cached: false };
  }
}
