// Macro data fetcher using Yahoo Finance (DXY, VIX) and Alpha Vantage (Treasury yields)
// Uses direct index data from Yahoo Finance - no ETF proxies needed

import type { MacroData } from "../types";
import { cachedFetch, DEFAULT_TTL, getTimestampAgeMinutes } from "../cache";
import { fetchDXY, fetchVIX } from "./yahoo";

const ALPHAVANTAGE_API = "https://www.alphavantage.co/query";

export interface MacroDataResult {
  data: MacroData;
  cacheHits: number;
  isStale: boolean;
}

interface AlphaVantageTreasuryYield {
  data: Array<{ date: string; value: string }>;
}

// Stale threshold in minutes for macro data
const STALE_THRESHOLD_MINUTES = 60;

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
  alphaVantage: string;
}

export async function fetchMacroData(apiKeys: MacroApiKeys): Promise<MacroDataResult> {
  const timestamp = new Date().toISOString();
  let cacheHits = 0;
  let isStale = false;

  // Fetch all data in parallel - each function handles its own errors with fallbacks
  // DXY and VIX use Yahoo Finance (no API key needed)
  // Treasury yields use Alpha Vantage
  const [dxyData, vixData, treasuryData] = await Promise.all([
    fetchDXY(),
    fetchVIX(),
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

  console.log(`[Macro] DXY: ${dxyData.price.toFixed(2)}, VIX: ${vixData.vix.toFixed(2)}, 10Y: ${treasuryData.yield.toFixed(2)}%`);
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
