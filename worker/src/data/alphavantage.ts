// Macro data fetcher using Twelve Data (DXY proxy, VIX proxy) and Alpha Vantage (Treasury yields)
// Uses ETF proxies since free tiers don't include actual indices

import type { MacroData } from "../types";

const ALPHAVANTAGE_API = "https://www.alphavantage.co/query";
const TWELVEDATA_API = "https://api.twelvedata.com";

interface AlphaVantageTreasuryYield {
  data: Array<{ date: string; value: string }>;
}

interface TwelveDataTimeSeries {
  values?: Array<{ datetime: string; close: string }>;
  status?: string;
  code?: number;
  message?: string;
}

// Get DXY proxy from Twelve Data using UUP ETF (PowerShares DB US Dollar Index)
// Returns price and calculated 20-day MA
async function getDXYData(apiKey: string): Promise<{ price: number; ma20: number }> {
  const symbol = "UUP";
  const url = `${TWELVEDATA_API}/time_series?symbol=${symbol}&interval=1day&outputsize=25&apikey=${apiKey}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`TwelveData UUP failed: ${res.status}`);
      return { price: 28.5, ma20: 28.5 }; // UUP typically trades around $28-29
    }

    const data: TwelveDataTimeSeries = await res.json();

    if (!data.values || data.values.length === 0 || data.status === "error") {
      console.warn("UUP data issue:", JSON.stringify(data).slice(0, 300));
      return { price: 28.5, ma20: 28.5 };
    }

    const closes = data.values.map(v => parseFloat(v.close)).filter(n => Number.isFinite(n) && n > 0);
    if (closes.length === 0) {
      return { price: 28.5, ma20: 28.5 };
    }

    const price = closes[0];
    const ma20 = closes.slice(0, 20).reduce((sum, c) => sum + c, 0) / Math.min(closes.length, 20);

    return { price, ma20 };
  } catch (error) {
    console.warn("DXY fetch error:", error);
    return { price: 28.5, ma20: 28.5 };
  }
}

// Get VIX proxy from Twelve Data using VIXY ETF
// Returns ETF price (not actual VIX value)
async function getVIXData(apiKey: string): Promise<number> {
  const symbol = "VIXY";
  const url = `${TWELVEDATA_API}/time_series?symbol=${symbol}&interval=1day&outputsize=1&apikey=${apiKey}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`TwelveData VIXY failed: ${res.status}`);
      return 20; // Typical VIX level
    }

    const data: TwelveDataTimeSeries = await res.json();

    if (!data.values || data.values.length === 0 || data.status === "error") {
      console.warn("VIXY data issue:", JSON.stringify(data).slice(0, 300));
      return 20;
    }

    const vix = parseFloat(data.values[0].close);
    if (!Number.isFinite(vix) || vix <= 0) {
      return 20;
    }

    return vix;
  } catch (error) {
    console.warn("VIX fetch error:", error);
    return 20;
  }
}

// Get 10-year Treasury yield from Alpha Vantage
// Falls back to a reasonable default if rate-limited
async function getTreasuryYield(apiKey: string): Promise<number> {
  try {
    const url = `${ALPHAVANTAGE_API}?function=TREASURY_YIELD&interval=daily&maturity=10year&apikey=${apiKey}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.warn(`AlphaVantage Treasury Yield HTTP error: ${res.status}`);
      return 4.5;
    }

    const data: AlphaVantageTreasuryYield = await res.json();

    if (!data.data || data.data.length === 0) {
      console.warn("Treasury yield rate-limited or unavailable");
      return 4.5;
    }

    const value = parseFloat(data.data[0].value);
    if (!Number.isFinite(value) || value <= 0) {
      return 4.5;
    }

    return value;
  } catch (error) {
    console.warn("Treasury yield fetch error:", error);
    return 4.5;
  }
}

export interface MacroApiKeys {
  twelveData: string;
  alphaVantage: string;
}

export async function fetchMacroData(apiKeys: MacroApiKeys): Promise<MacroData> {
  const timestamp = new Date().toISOString();

  // Fetch all data in parallel - each function handles its own errors with fallbacks
  const [dxyData, vix, us10y] = await Promise.all([
    getDXYData(apiKeys.twelveData),
    getVIXData(apiKeys.twelveData),
    getTreasuryYield(apiKeys.alphaVantage),
  ]);

  return {
    dxy: dxyData.price,
    dxyMa20: dxyData.ma20,
    vix,
    us10y,
    timestamp,
  };
}
