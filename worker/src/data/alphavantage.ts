// Alpha Vantage API for macro data (DXY, VIX, 10Y yields)
// Free tier: 25 requests/day

import type { MacroData } from "../types";

const ALPHAVANTAGE_API = "https://www.alphavantage.co/query";

interface AlphaVantageTimeSeries {
  "Time Series (Daily)": Record<string, {
    "1. open": string;
    "2. high": string;
    "3. low": string;
    "4. close": string;
    "5. volume": string;
  }>;
}

interface AlphaVantageTreasuryYield {
  data: Array<{ date: string; value: string }>;
}

// Get price and 20-day MA for a symbol
async function getSymbolData(
  symbol: string,
  apiKey: string
): Promise<{ price: number; ma20: number }> {
  const url = `${ALPHAVANTAGE_API}?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`AlphaVantage failed for ${symbol}: ${res.status}`);
  }

  const data: AlphaVantageTimeSeries = await res.json();
  const timeSeries = data["Time Series (Daily)"];

  if (!timeSeries) {
    throw new Error(`No time series data for ${symbol}`);
  }

  const dates = Object.keys(timeSeries).sort().reverse();
  const price = parseFloat(timeSeries[dates[0]]["4. close"]);

  // Calculate 20-day MA
  const closes = dates.slice(0, 20).map(d => parseFloat(timeSeries[d]["4. close"]));
  const ma20 = closes.reduce((sum, c) => sum + c, 0) / closes.length;

  return { price, ma20 };
}

// Get 10-year Treasury yield
async function getTreasuryYield(apiKey: string): Promise<number> {
  const url = `${ALPHAVANTAGE_API}?function=TREASURY_YIELD&interval=daily&maturity=10year&apikey=${apiKey}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`AlphaVantage Treasury Yield failed: ${res.status}`);
  }

  const data: AlphaVantageTreasuryYield = await res.json();

  if (!data.data || data.data.length === 0) {
    throw new Error("No Treasury yield data");
  }

  return parseFloat(data.data[0].value);
}

export async function fetchMacroData(apiKey: string): Promise<MacroData> {
  const timestamp = new Date().toISOString();

  // Fetch DXY (US Dollar Index) - using UUP ETF as proxy
  // VIX - using VIX index
  // Note: AlphaVantage has limited free tier, so we fetch sequentially

  try {
    // DXY proxy using UUP (PowerShares DB US Dollar Index)
    const dxyData = await getSymbolData("UUP", apiKey);

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));

    // VIX - Note: Alpha Vantage doesn't have VIX directly
    // Using VIXY ETF as proxy
    const vixData = await getSymbolData("VIXY", apiKey);

    await new Promise(resolve => setTimeout(resolve, 500));

    // 10-year Treasury yield
    const us10y = await getTreasuryYield(apiKey);

    return {
      dxy: dxyData.price,
      dxyMa20: dxyData.ma20,
      vix: vixData.price, // This is VIXY price, not actual VIX
      us10y,
      timestamp,
    };
  } catch (error) {
    console.error("Failed to fetch macro data:", error);
    // Return defaults if macro fetch fails
    return {
      dxy: 0,
      dxyMa20: 0,
      vix: 0,
      us10y: 0,
      timestamp,
    };
  }
}
