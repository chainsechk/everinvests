// Macro data fetcher using Twelve Data (DXY proxy, VIX proxy) and Alpha Vantage (Treasury yields)
// Uses ETF proxies since free tiers don't include actual indices

import type { MacroData } from "../types";
import { cachedFetch, DEFAULT_TTL, getTimestampAgeMinutes } from "../cache";

const ALPHAVANTAGE_API = "https://www.alphavantage.co/query";
const TWELVEDATA_API = "https://api.twelvedata.com";

export interface MacroDataResult {
  data: MacroData;
  cacheHits: number;
  isStale: boolean;
}

interface AlphaVantageTreasuryYield {
  data: Array<{ date: string; value: string }>;
}

interface TwelveDataTimeSeries {
  values?: Array<{ datetime: string; close: string }>;
  status?: string;
  code?: number;
  message?: string;
}

// Stale threshold in minutes for macro data
const STALE_THRESHOLD_MINUTES = 60;

// Get DXY proxy from Twelve Data using UUP ETF (PowerShares DB US Dollar Index)
// Returns price and calculated 20-day MA with caching
async function getDXYData(apiKey: string): Promise<{
  price: number;
  ma20: number;
  cached: boolean;
  cachedAt?: string;
}> {
  const symbol = "UUP";
  const url = `${TWELVEDATA_API}/time_series?symbol=${symbol}&interval=1day&outputsize=25&apikey=${apiKey}`;

  try {
    const { data, cached, cachedAt } = await cachedFetch<TwelveDataTimeSeries>(
      url,
      DEFAULT_TTL.MACRO
    );

    if (!data.values || data.values.length === 0 || data.status === "error") {
      console.warn("UUP data issue:", JSON.stringify(data).slice(0, 300));
      return { price: 28.5, ma20: 28.5, cached }; // UUP typically trades around $28-29
    }

    const closes = data.values.map(v => parseFloat(v.close)).filter(n => Number.isFinite(n) && n > 0);
    if (closes.length === 0) {
      return { price: 28.5, ma20: 28.5, cached };
    }

    const price = closes[0];
    const ma20 = closes.slice(0, 20).reduce((sum, c) => sum + c, 0) / Math.min(closes.length, 20);

    return { price, ma20, cached, cachedAt };
  } catch (error) {
    console.warn("DXY fetch error:", error);
    return { price: 28.5, ma20: 28.5, cached: false };
  }
}

// Get VIX proxy from Twelve Data using VIXY ETF with caching
// Returns ETF price (not actual VIX value)
async function getVIXData(apiKey: string): Promise<{
  vix: number;
  cached: boolean;
}> {
  const symbol = "VIXY";
  const url = `${TWELVEDATA_API}/time_series?symbol=${symbol}&interval=1day&outputsize=1&apikey=${apiKey}`;

  try {
    const { data, cached } = await cachedFetch<TwelveDataTimeSeries>(
      url,
      DEFAULT_TTL.MACRO
    );

    if (!data.values || data.values.length === 0 || data.status === "error") {
      console.warn("VIXY data issue:", JSON.stringify(data).slice(0, 300));
      return { vix: 20, cached }; // Typical VIX level
    }

    const vix = parseFloat(data.values[0].close);
    if (!Number.isFinite(vix) || vix <= 0) {
      return { vix: 20, cached };
    }

    return { vix, cached };
  } catch (error) {
    console.warn("VIX fetch error:", error);
    return { vix: 20, cached: false };
  }
}

// Get 10-year Treasury yield from Alpha Vantage with caching
// Falls back to a reasonable default if rate-limited
async function getTreasuryYield(apiKey: string): Promise<{
  yield: number;
  cached: boolean;
}> {
  const url = `${ALPHAVANTAGE_API}?function=TREASURY_YIELD&interval=daily&maturity=10year&apikey=${apiKey}`;

  try {
    const { data, cached } = await cachedFetch<AlphaVantageTreasuryYield>(
      url,
      DEFAULT_TTL.MACRO
    );

    if (!data.data || data.data.length === 0) {
      console.warn("Treasury yield rate-limited or unavailable");
      return { yield: 4.5, cached };
    }

    const value = parseFloat(data.data[0].value);
    if (!Number.isFinite(value) || value <= 0) {
      return { yield: 4.5, cached };
    }

    return { yield: value, cached };
  } catch (error) {
    console.warn("Treasury yield fetch error:", error);
    return { yield: 4.5, cached: false };
  }
}

export interface MacroApiKeys {
  twelveData: string;
  alphaVantage: string;
}

export async function fetchMacroData(apiKeys: MacroApiKeys): Promise<MacroDataResult> {
  const timestamp = new Date().toISOString();
  let cacheHits = 0;
  let isStale = false;

  // Fetch all data in parallel - each function handles its own errors with fallbacks
  const [dxyData, vixData, treasuryData] = await Promise.all([
    getDXYData(apiKeys.twelveData),
    getVIXData(apiKeys.twelveData),
    getTreasuryYield(apiKeys.alphaVantage),
  ]);

  // Count cache hits
  if (dxyData.cached) cacheHits++;
  if (vixData.cached) cacheHits++;
  if (treasuryData.cached) cacheHits++;

  // Check staleness based on DXY (most important indicator)
  if (dxyData.cached && dxyData.cachedAt) {
    const ageMinutes = getTimestampAgeMinutes(dxyData.cachedAt);
    isStale = ageMinutes > STALE_THRESHOLD_MINUTES;
  }

  console.log(`[Macro] Cache hits: ${cacheHits}/3, Stale: ${isStale}`);

  return {
    data: {
      dxy: dxyData.price,
      dxyMa20: dxyData.ma20,
      vix: vixData.vix,
      us10y: treasuryData.yield,
      timestamp,
    },
    cacheHits,
    isStale,
  };
}
