// Twelve Data API for forex and stocks
// Free tier: 800 requests/day, 8 requests/minute

import type { AssetData, ForexTicker, StockTicker } from "../types";
import { cachedFetch, DEFAULT_TTL, getTimestampAgeMinutes } from "../cache";

const TWELVEDATA_API = "https://api.twelvedata.com";

export interface TwelveDataFetchResult {
  data: AssetData[];
  cacheHits: number;
  staleAssets: string[];
}

export const STOCK_KEY_TICKERS = ["NVDA", "MSFT", "XOM", "ORCL", "AAPL"] as const satisfies readonly StockTicker[];

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

// Stale threshold in minutes (data older than this is considered stale)
const STALE_THRESHOLD_MINUTES = 30;

// Get current price with caching
async function getPrice(
  symbol: string,
  apiKey: string
): Promise<{ price: number; cached: boolean; cachedAt?: string }> {
  const url = `${TWELVEDATA_API}/quote?symbol=${symbol}&apikey=${apiKey}`;
  const { data, cached, cachedAt } = await cachedFetch<TwelveDataQuote>(
    url,
    DEFAULT_TTL.TWELVEDATA_QUOTE
  );

  if (!data.close) {
    throw new Error(`No price data for ${symbol}`);
  }

  const price = parseFloat(data.close);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Invalid price data for ${symbol}`);
  }
  return { price, cached, cachedAt };
}

// Get 20-day SMA with caching
async function getMA20(
  symbol: string,
  apiKey: string
): Promise<{ ma20: number; cached: boolean }> {
  const url = `${TWELVEDATA_API}/sma?symbol=${symbol}&interval=1day&time_period=20&apikey=${apiKey}`;
  const { data, cached } = await cachedFetch<TwelveDataMA>(
    url,
    DEFAULT_TTL.TWELVEDATA_SMA
  );

  if (!data.values || data.values.length === 0) {
    throw new Error(`No MA data for ${symbol}`);
  }

  const ma20 = parseFloat(data.values[0].ma);
  if (!Number.isFinite(ma20) || ma20 <= 0) {
    throw new Error(`Invalid MA data for ${symbol}`);
  }
  return { ma20, cached };
}

// Get RSI (14-period) with caching
async function getRSI(
  symbol: string,
  apiKey: string
): Promise<{ rsi: number; cached: boolean }> {
  const url = `${TWELVEDATA_API}/rsi?symbol=${symbol}&interval=1day&time_period=14&apikey=${apiKey}`;
  const { data, cached } = await cachedFetch<TwelveDataRSI>(
    url,
    DEFAULT_TTL.TWELVEDATA_RSI
  );

  if (!data.values || data.values.length === 0) {
    throw new Error(`No RSI data for ${symbol}`);
  }

  const rsi = parseFloat(data.values[0].rsi);
  if (!Number.isFinite(rsi) || rsi < 0 || rsi > 100) {
    throw new Error(`Invalid RSI data for ${symbol}`);
  }
  return { rsi, cached };
}

interface FetchAssetResult {
  data: AssetData;
  cacheHits: number;
  isStale: boolean;
}

// Fetch data for a single asset
async function fetchAssetData(
  ticker: string,
  apiKey: string,
  sequential: boolean = false
): Promise<FetchAssetResult> {
  const timestamp = new Date().toISOString();

  let priceResult: { price: number; cached: boolean; cachedAt?: string };
  let maResult: { ma20: number; cached: boolean };
  let rsiResult: { rsi: number; cached: boolean };

  if (sequential) {
    // Sequential calls with delays for rate limiting
    priceResult = await getPrice(ticker, apiKey);
    // Only delay if not cached (fresh API call)
    if (!priceResult.cached) {
      await new Promise(r => setTimeout(r, 1000));
    }
    maResult = await getMA20(ticker, apiKey);
    if (!maResult.cached) {
      await new Promise(r => setTimeout(r, 1000));
    }
    rsiResult = await getRSI(ticker, apiKey);
  } else {
    // Parallel calls for faster execution
    [priceResult, maResult, rsiResult] = await Promise.all([
      getPrice(ticker, apiKey),
      getMA20(ticker, apiKey),
      getRSI(ticker, apiKey),
    ]);
  }

  // Count cache hits
  const cacheHits = [priceResult.cached, maResult.cached, rsiResult.cached]
    .filter(Boolean).length;

  // Check if price data is stale (older than threshold)
  let isStale = false;
  if (priceResult.cached && priceResult.cachedAt) {
    const ageMinutes = getTimestampAgeMinutes(priceResult.cachedAt);
    isStale = ageMinutes > STALE_THRESHOLD_MINUTES;
  }

  return {
    data: {
      ticker,
      price: priceResult.price,
      ma20: maResult.ma20,
      secondaryIndicator: rsiResult.rsi,
      timestamp,
    },
    cacheHits,
    isStale,
  };
}

// Batch fetch for forex
export async function fetchForexData(
  tickers: readonly ForexTicker[],
  apiKey: string
): Promise<TwelveDataFetchResult> {
  const results: AssetData[] = [];
  let totalCacheHits = 0;
  const staleAssets: string[] = [];

  // Process sequentially to respect rate limits (8/min)
  for (const ticker of tickers) {
    try {
      // TwelveData uses format like "EUR/USD"
      const result = await fetchAssetData(ticker, apiKey);
      results.push(result.data);
      totalCacheHits += result.cacheHits;

      if (result.isStale) {
        staleAssets.push(ticker);
      }

      // Only delay if we're making fresh API calls
      if (result.cacheHits < 3) {
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    } catch (error) {
      console.error(`Failed to fetch ${ticker}:`, error);
    }
  }

  console.log(`[Forex] Cache hits: ${totalCacheHits}, Stale: ${staleAssets.length}`);
  return { data: results, cacheHits: totalCacheHits, staleAssets };
}

// Batch fetch for stocks
// Note: TwelveData free tier has 8 req/min limit
// We limit to 5 key stocks and use sequential calls per ticker
export async function fetchStockData(
  tickers: readonly StockTicker[],
  apiKey: string
): Promise<TwelveDataFetchResult> {
  const results: AssetData[] = [];
  let totalCacheHits = 0;
  const staleAssets: string[] = [];

  const keyStocks = (tickers.length > 0 ? tickers : STOCK_KEY_TICKERS).slice(0, 5);
  console.log(`[Stocks] Fetching ${keyStocks.length} key tickers`);

  for (const ticker of keyStocks) {
    try {
      // Use sequential mode with built-in delays
      const result = await fetchAssetData(ticker, apiKey, true);
      results.push(result.data);
      totalCacheHits += result.cacheHits;

      if (result.isStale) {
        staleAssets.push(ticker);
      }

      // Only add delay if we're making fresh API calls
      if (result.cacheHits < 3) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Stocks] Failed to fetch ${ticker}: ${errMsg}`);
      // Add delay even on error
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  console.log(`[Stocks] Cache hits: ${totalCacheHits}, Stale: ${staleAssets.length}`);
  return { data: results, cacheHits: totalCacheHits, staleAssets };
}
