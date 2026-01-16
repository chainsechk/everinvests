// Twelve Data API for forex and stocks
// Free tier: 800 requests/day, 8 requests/minute

import type { AssetData, ForexTicker, StockTicker } from "../types";

const TWELVEDATA_API = "https://api.twelvedata.com";

interface TwelveDataQuote {
  symbol: string;
  close: string;
  datetime: string;
}

interface TwelveDataMA {
  values: Array<{ datetime: string; ma: string }>;
}

interface TwelveDataRSI {
  values: Array<{ datetime: string; rsi: string }>;
}

// Get current price
async function getPrice(symbol: string, apiKey: string): Promise<number> {
  const url = `${TWELVEDATA_API}/quote?symbol=${symbol}&apikey=${apiKey}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`TwelveData quote failed for ${symbol}: ${res.status}`);
  }

  const data: TwelveDataQuote = await res.json();
  if (!data.close) {
    throw new Error(`No price data for ${symbol}`);
  }

  return parseFloat(data.close);
}

// Get 20-day SMA
async function getMA20(symbol: string, apiKey: string): Promise<number> {
  const url = `${TWELVEDATA_API}/sma?symbol=${symbol}&interval=1day&time_period=20&apikey=${apiKey}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`TwelveData MA failed for ${symbol}: ${res.status}`);
  }

  const data: TwelveDataMA = await res.json();
  if (!data.values || data.values.length === 0) {
    throw new Error(`No MA data for ${symbol}`);
  }

  return parseFloat(data.values[0].ma);
}

// Get RSI (14-period)
async function getRSI(symbol: string, apiKey: string): Promise<number> {
  const url = `${TWELVEDATA_API}/rsi?symbol=${symbol}&interval=1day&time_period=14&apikey=${apiKey}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`TwelveData RSI failed for ${symbol}: ${res.status}`);
  }

  const data: TwelveDataRSI = await res.json();
  if (!data.values || data.values.length === 0) {
    throw new Error(`No RSI data for ${symbol}`);
  }

  return parseFloat(data.values[0].rsi);
}

// Fetch data for a single asset
async function fetchAssetData(
  ticker: string,
  apiKey: string,
  sequential: boolean = false
): Promise<AssetData> {
  const timestamp = new Date().toISOString();

  let price: number, ma20: number, rsi: number;

  if (sequential) {
    // Sequential calls with delays for rate limiting
    price = await getPrice(ticker, apiKey);
    await new Promise(r => setTimeout(r, 1000));
    ma20 = await getMA20(ticker, apiKey);
    await new Promise(r => setTimeout(r, 1000));
    rsi = await getRSI(ticker, apiKey);
  } else {
    // Parallel calls for faster execution
    [price, ma20, rsi] = await Promise.all([
      getPrice(ticker, apiKey),
      getMA20(ticker, apiKey),
      getRSI(ticker, apiKey),
    ]);
  }

  return {
    ticker,
    price,
    ma20,
    secondaryIndicator: rsi,
    timestamp,
  };
}

// Batch fetch for forex
export async function fetchForexData(
  tickers: readonly ForexTicker[],
  apiKey: string
): Promise<AssetData[]> {
  const results: AssetData[] = [];

  // Process sequentially to respect rate limits (8/min)
  for (const ticker of tickers) {
    try {
      // TwelveData uses format like "EUR/USD"
      const data = await fetchAssetData(ticker, apiKey);
      results.push(data);

      // Small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 250));
    } catch (error) {
      console.error(`Failed to fetch ${ticker}:`, error);
    }
  }

  return results;
}

// Batch fetch for stocks
// Note: TwelveData free tier has 8 req/min limit
// We limit to 5 key stocks and use sequential calls per ticker
export async function fetchStockData(
  tickers: readonly StockTicker[],
  apiKey: string
): Promise<AssetData[]> {
  const results: AssetData[] = [];

  // Limit to 5 key stocks: 1 from each sector (semi, AI, energy, cloud, general tech)
  // This keeps us at 15 API calls total, manageable within rate limits
  const keyStocks: StockTicker[] = ["NVDA", "MSFT", "XOM", "ORCL", "AAPL"];
  console.log(`[Stocks] Fetching ${keyStocks.length} key tickers`);

  for (const ticker of keyStocks) {
    try {
      // Use sequential mode with built-in delays
      const data = await fetchAssetData(ticker, apiKey, true);
      results.push(data);

      // Additional delay between tickers
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Stocks] Failed to fetch ${ticker}: ${errMsg}`);
      // Add delay even on error
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  return results;
}
