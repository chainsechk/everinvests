// Twelve Data API for forex and stocks
// Free tier: 800 requests/day, 8 requests/minute

import type { AssetData, ForexTicker, StockTicker } from "../types";
import { cachedFetch, DEFAULT_TTL, getTimestampAgeMinutes } from "../cache";

const TWELVEDATA_API = "https://api.twelvedata.com";

// Longer timeout for TwelveData API calls (25 seconds)
const TWELVEDATA_TIMEOUT_MS = 25000;

export interface TwelveDataFetchResult {
  data: AssetData[];
  cacheHits: number;
  staleAssets: string[];
}

// Key stocks: 2 per sector for balanced coverage
// Semis: NVDA, AMD | AI Infra: MSFT, AAPL | Energy: XOM, CVX | Cloud: ORCL, PLTR
export const STOCK_KEY_TICKERS = [
  "NVDA", "AMD",    // Semiconductors
  "MSFT", "AAPL",   // AI Infrastructure
  "XOM", "CVX",     // Energy
  "ORCL", "PLTR",   // Data Centers / Cloud
] as const satisfies readonly StockTicker[];

interface TwelveDataQuote {
  symbol: string;
  close: string;
  datetime: string;
}

interface TwelveDataMA {
  values: Array<{ datetime: string; ma: string }>;
}

// Time series response for computing MA ourselves
interface TwelveDataTimeSeries {
  values: Array<{ datetime: string; close: string }>;
}

interface TwelveDataRSI {
  values: Array<{ datetime: string; rsi: string }>;
}

// TwelveData error response (returned with 200 status code)
interface TwelveDataError {
  code: number;
  message: string;
  status: "error";
}

// Check if response is a TwelveData error
function isTwelveDataError(data: unknown): data is TwelveDataError {
  return (
    typeof data === "object" &&
    data !== null &&
    "status" in data &&
    (data as TwelveDataError).status === "error"
  );
}

// Stale threshold in minutes (data older than this is considered stale)
const STALE_THRESHOLD_MINUTES = 30;

// Get current price with caching
async function getPrice(
  symbol: string,
  apiKey: string
): Promise<{ price: number; cached: boolean; cachedAt?: string }> {
  const url = `${TWELVEDATA_API}/quote?symbol=${symbol}&apikey=${apiKey}`;
  const { data, cached, cachedAt } = await cachedFetch<TwelveDataQuote | TwelveDataError>(
    url,
    DEFAULT_TTL.TWELVEDATA_QUOTE,
    undefined,
    TWELVEDATA_TIMEOUT_MS
  );

  // Check for TwelveData API error
  if (isTwelveDataError(data)) {
    throw new Error(`TwelveData error for ${symbol}: ${data.message} (code ${data.code})`);
  }

  if (!data.close) {
    throw new Error(`No price data for ${symbol}`);
  }

  const price = parseFloat(data.close);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Invalid price data for ${symbol}`);
  }
  return { price, cached, cachedAt };
}

// Get 20-day SMA by fetching time series and computing locally
// This is more reliable than the SMA endpoint for forex pairs
async function getMA20(
  symbol: string,
  apiKey: string
): Promise<{ ma20: number; cached: boolean }> {
  // Fetch last 25 days of data to ensure we have at least 20 data points
  const url = `${TWELVEDATA_API}/time_series?symbol=${symbol}&interval=1day&outputsize=25&apikey=${apiKey}`;
  const { data, cached } = await cachedFetch<TwelveDataTimeSeries | TwelveDataError>(
    url,
    DEFAULT_TTL.TWELVEDATA_SMA,
    undefined,
    TWELVEDATA_TIMEOUT_MS
  );

  // Check for TwelveData API error
  if (isTwelveDataError(data)) {
    throw new Error(`TwelveData error for ${symbol}: ${data.message} (code ${data.code})`);
  }

  if (!data.values || data.values.length < 20) {
    console.warn(`[TwelveData] Insufficient time series data for ${symbol}: ${data.values?.length || 0} values`);
    throw new Error(`No MA data for ${symbol}`);
  }

  // Calculate 20-day SMA from the most recent 20 close prices
  const closes = data.values.slice(0, 20).map(v => parseFloat(v.close));
  const validCloses = closes.filter(c => Number.isFinite(c) && c > 0);

  if (validCloses.length < 20) {
    console.warn(`[TwelveData] Only ${validCloses.length} valid close prices for ${symbol}`);
    throw new Error(`Invalid MA data for ${symbol}`);
  }

  const ma20 = validCloses.reduce((sum, c) => sum + c, 0) / validCloses.length;

  if (!Number.isFinite(ma20) || ma20 <= 0) {
    throw new Error(`Invalid MA calculation for ${symbol}`);
  }

  return { ma20, cached };
}

// Get RSI (14-period) with caching
async function getRSI(
  symbol: string,
  apiKey: string
): Promise<{ rsi: number; cached: boolean }> {
  const url = `${TWELVEDATA_API}/rsi?symbol=${symbol}&interval=1day&time_period=14&apikey=${apiKey}`;
  const { data, cached } = await cachedFetch<TwelveDataRSI | TwelveDataError>(
    url,
    DEFAULT_TTL.TWELVEDATA_RSI,
    undefined,
    TWELVEDATA_TIMEOUT_MS
  );

  // Check for TwelveData API error
  if (isTwelveDataError(data)) {
    throw new Error(`TwelveData error for ${symbol}: ${data.message} (code ${data.code})`);
  }

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
    // Sequential calls with delays for rate limiting (8 req/min = 7.5s per call)
    priceResult = await getPrice(ticker, apiKey);
    // Delay between calls to stay within rate limit
    if (!priceResult.cached) {
      await new Promise(r => setTimeout(r, 5000));
    }
    maResult = await getMA20(ticker, apiKey);
    if (!maResult.cached) {
      await new Promise(r => setTimeout(r, 5000));
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
// Note: TwelveData free tier has 8 req/min limit
// 4 forex pairs × 3 calls each = 12 calls, so we use sequential mode
export async function fetchForexData(
  tickers: readonly ForexTicker[],
  apiKey: string
): Promise<TwelveDataFetchResult> {
  const results: AssetData[] = [];
  let totalCacheHits = 0;
  const staleAssets: string[] = [];

  console.log(`[Forex] Fetching ${tickers.length} currency pairs`);

  // Process sequentially to respect rate limits (8/min)
  for (const ticker of tickers) {
    try {
      // Use sequential mode with built-in delays (like stocks)
      const result = await fetchAssetData(ticker, apiKey, true);
      results.push(result.data);
      totalCacheHits += result.cacheHits;

      if (result.isStale) {
        staleAssets.push(ticker);
      }

      // Add delay between tickers if we made fresh API calls
      if (result.cacheHits < 3) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Forex] Failed to fetch ${ticker}: ${errMsg}`);
      // Add delay even on error to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  console.log(`[Forex] Cache hits: ${totalCacheHits}, Stale: ${staleAssets.length}`);
  return { data: results, cacheHits: totalCacheHits, staleAssets };
}

// Batch fetch for stocks
// Note: TwelveData free tier has 8 req/min limit
// 8 tickers × 3 calls = 24 calls, requires ~3 minutes with 8s inter-ticker delays
export async function fetchStockData(
  tickers: readonly StockTicker[],
  apiKey: string
): Promise<TwelveDataFetchResult> {
  const results: AssetData[] = [];
  let totalCacheHits = 0;
  const staleAssets: string[] = [];

  const keyStocks = (tickers.length > 0 ? tickers : STOCK_KEY_TICKERS).slice(0, 8);
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

      // Add delay to stay within 8 req/min rate limit
      // 8 tickers × 3 calls = 24 calls, need ~3 minutes minimum
      if (result.cacheHits < 3) {
        await new Promise(resolve => setTimeout(resolve, 8000));
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Stocks] Failed to fetch ${ticker}: ${errMsg}`);
      // Add delay even on error to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 8000));
    }
  }

  console.log(`[Stocks] Cache hits: ${totalCacheHits}, Stale: ${staleAssets.length}`);
  return { data: results, cacheHits: totalCacheHits, staleAssets };
}
