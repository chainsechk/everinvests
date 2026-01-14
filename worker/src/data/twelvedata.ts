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
  apiKey: string
): Promise<AssetData> {
  const timestamp = new Date().toISOString();

  // Fetch all data in parallel
  const [price, ma20, rsi] = await Promise.all([
    getPrice(ticker, apiKey),
    getMA20(ticker, apiKey),
    getRSI(ticker, apiKey),
  ]);

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
export async function fetchStockData(
  tickers: readonly StockTicker[],
  apiKey: string
): Promise<AssetData[]> {
  const results: AssetData[] = [];

  // Process sequentially to respect rate limits
  for (const ticker of tickers) {
    try {
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
