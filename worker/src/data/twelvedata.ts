// Twelve Data API for forex and stocks
// Free tier: 800 requests/day, 8 requests/minute
// Using BATCH mode to reduce API calls (comma-separated symbols)

import type { AssetData, ForexTicker, StockTicker } from "../types";
import { cachedFetch, DEFAULT_TTL, getTimestampAgeMinutes } from "../cache";

const TWELVEDATA_API = "https://api.twelvedata.com";

// Longer timeout for TwelveData batch API calls (45 seconds for multiple symbols)
const TWELVEDATA_TIMEOUT_MS = 45000;

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

// Batch response is keyed by symbol
type BatchQuoteResponse = Record<string, TwelveDataQuote | TwelveDataError>;
type BatchTimeSeriesResponse = Record<string, TwelveDataTimeSeries | TwelveDataError>;
type BatchRSIResponse = Record<string, TwelveDataRSI | TwelveDataError>;

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

// ============================================================
// BATCH API functions - fetch multiple symbols in one request
// Reduces API calls from 24 (8 symbols × 3 endpoints) to just 3
// ============================================================

// Batch fetch quotes for multiple symbols
async function getBatchQuotes(
  symbols: string[],
  apiKey: string
): Promise<{ quotes: Map<string, number>; cached: boolean; cachedAt?: string }> {
  const symbolList = symbols.join(",");
  const url = `${TWELVEDATA_API}/quote?symbol=${symbolList}&apikey=${apiKey}`;

  const { data, cached, cachedAt } = await cachedFetch<BatchQuoteResponse | TwelveDataQuote | TwelveDataError>(
    url,
    DEFAULT_TTL.TWELVEDATA_QUOTE,
    undefined,
    TWELVEDATA_TIMEOUT_MS
  );

  const quotes = new Map<string, number>();

  // Single symbol returns object directly, multiple returns keyed object
  if (symbols.length === 1) {
    const singleData = data as TwelveDataQuote | TwelveDataError;
    if (!isTwelveDataError(singleData) && singleData.close) {
      const price = parseFloat(singleData.close);
      if (Number.isFinite(price) && price > 0) {
        quotes.set(symbols[0], price);
      }
    }
  } else {
    const batchData = data as BatchQuoteResponse;
    for (const symbol of symbols) {
      const quote = batchData[symbol];
      if (quote && !isTwelveDataError(quote) && quote.close) {
        const price = parseFloat(quote.close);
        if (Number.isFinite(price) && price > 0) {
          quotes.set(symbol, price);
        }
      }
    }
  }

  return { quotes, cached, cachedAt };
}

// Batch fetch time series for multiple symbols (to compute MA20)
async function getBatchTimeSeries(
  symbols: string[],
  apiKey: string
): Promise<{ ma20s: Map<string, number>; cached: boolean }> {
  const symbolList = symbols.join(",");
  const url = `${TWELVEDATA_API}/time_series?symbol=${symbolList}&interval=1day&outputsize=25&apikey=${apiKey}`;

  const { data, cached } = await cachedFetch<BatchTimeSeriesResponse | TwelveDataTimeSeries | TwelveDataError>(
    url,
    DEFAULT_TTL.TWELVEDATA_SMA,
    undefined,
    TWELVEDATA_TIMEOUT_MS
  );

  const ma20s = new Map<string, number>();

  // Helper to calculate MA20 from time series
  const calcMA20 = (ts: TwelveDataTimeSeries): number | null => {
    if (!ts.values || ts.values.length < 20) {
      console.warn(`[TwelveData] Insufficient values: ${ts.values?.length || 0}`);
      return null;
    }
    const closes = ts.values.slice(0, 20).map(v => parseFloat(v.close));
    const validCloses = closes.filter(c => Number.isFinite(c) && c > 0);
    if (validCloses.length < 20) {
      console.warn(`[TwelveData] Only ${validCloses.length} valid closes`);
      return null;
    }
    const ma = validCloses.reduce((sum, c) => sum + c, 0) / validCloses.length;
    return Number.isFinite(ma) && ma > 0 ? ma : null;
  };

  // Check for top-level error (rate limit, etc.)
  if (isTwelveDataError(data)) {
    console.error(`[TwelveData] Batch time_series error: ${(data as TwelveDataError).message}`);
    return { ma20s, cached };
  }

  // Single symbol returns object directly with values at top level
  if (symbols.length === 1) {
    const singleData = data as TwelveDataTimeSeries | TwelveDataError;
    if (!isTwelveDataError(singleData)) {
      const ma = calcMA20(singleData);
      if (ma !== null) ma20s.set(symbols[0], ma);
    }
  } else {
    // Multi-symbol: check response structure
    const responseKeys = Object.keys(data);
    console.log(`[TwelveData] time_series response keys: ${responseKeys.join(", ")}`);

    const batchData = data as BatchTimeSeriesResponse;
    for (const symbol of symbols) {
      const ts = batchData[symbol];
      if (!ts) {
        console.warn(`[TwelveData] No time_series data for ${symbol}`);
        continue;
      }
      if (isTwelveDataError(ts)) {
        console.warn(`[TwelveData] Error for ${symbol}: ${(ts as TwelveDataError).message}`);
        continue;
      }
      const ma = calcMA20(ts as TwelveDataTimeSeries);
      if (ma !== null) {
        ma20s.set(symbol, ma);
      }
    }
  }

  return { ma20s, cached };
}

// Batch fetch RSI for multiple symbols
async function getBatchRSI(
  symbols: string[],
  apiKey: string
): Promise<{ rsis: Map<string, number>; cached: boolean }> {
  const symbolList = symbols.join(",");
  const url = `${TWELVEDATA_API}/rsi?symbol=${symbolList}&interval=1day&time_period=14&apikey=${apiKey}`;

  const { data, cached } = await cachedFetch<BatchRSIResponse | TwelveDataRSI | TwelveDataError>(
    url,
    DEFAULT_TTL.TWELVEDATA_RSI,
    undefined,
    TWELVEDATA_TIMEOUT_MS
  );

  const rsis = new Map<string, number>();

  // Single symbol returns object directly
  if (symbols.length === 1) {
    const singleData = data as TwelveDataRSI | TwelveDataError;
    if (!isTwelveDataError(singleData) && singleData.values?.length > 0) {
      const rsi = parseFloat(singleData.values[0].rsi);
      if (Number.isFinite(rsi) && rsi >= 0 && rsi <= 100) {
        rsis.set(symbols[0], rsi);
      }
    }
  } else {
    const batchData = data as BatchRSIResponse;
    for (const symbol of symbols) {
      const rsiData = batchData[symbol];
      if (rsiData && !isTwelveDataError(rsiData)) {
        const rsi = rsiData as TwelveDataRSI;
        if (rsi.values?.length > 0) {
          const val = parseFloat(rsi.values[0].rsi);
          if (Number.isFinite(val) && val >= 0 && val <= 100) {
            rsis.set(symbol, val);
          }
        }
      }
    }
  }

  return { rsis, cached };
}

// Batch fetch all data for multiple symbols (3 API calls total, sequential to respect rate limit)
async function fetchBatchData(
  symbols: string[],
  apiKey: string,
  category: string
): Promise<TwelveDataFetchResult> {
  const timestamp = new Date().toISOString();
  const results: AssetData[] = [];
  const staleAssets: string[] = [];
  let totalCacheHits = 0;

  // TwelveData rate limit: 8 API credits/minute
  // Each symbol in a batch counts as 1 credit
  // For N symbols: need to wait (N/8)*60 seconds between batch calls
  const creditsPerBatch = symbols.length;
  const waitTimeMs = Math.ceil((creditsPerBatch / 8) * 60 * 1000);

  console.log(`[${category}] Batch fetching ${symbols.length} symbols (${creditsPerBatch} credits/call, ${waitTimeMs/1000}s wait)`);

  // Make 3 batch API calls SEQUENTIALLY with proper delays
  const quotesResult = await getBatchQuotes(symbols, apiKey);
  if (!quotesResult.cached) {
    console.log(`[${category}] Waiting ${waitTimeMs/1000}s for rate limit...`);
    await new Promise(r => setTimeout(r, waitTimeMs));
  }

  const ma20sResult = await getBatchTimeSeries(symbols, apiKey);
  if (!ma20sResult.cached) {
    console.log(`[${category}] Waiting ${waitTimeMs/1000}s for rate limit...`);
    await new Promise(r => setTimeout(r, waitTimeMs));
  }

  const rsisResult = await getBatchRSI(symbols, apiKey);

  // Count cache hits
  if (quotesResult.cached) totalCacheHits++;
  if (ma20sResult.cached) totalCacheHits++;
  if (rsisResult.cached) totalCacheHits++;

  // Check staleness
  if (quotesResult.cached && quotesResult.cachedAt) {
    const ageMinutes = getTimestampAgeMinutes(quotesResult.cachedAt);
    if (ageMinutes > STALE_THRESHOLD_MINUTES) {
      // All symbols from this batch are stale
      staleAssets.push(...symbols);
    }
  }

  // Combine results for each symbol
  for (const symbol of symbols) {
    const price = quotesResult.quotes.get(symbol);
    const ma20 = ma20sResult.ma20s.get(symbol);
    const rsi = rsisResult.rsis.get(symbol);

    if (price !== undefined && ma20 !== undefined && rsi !== undefined) {
      results.push({
        ticker: symbol,
        price,
        ma20,
        secondaryIndicator: rsi,
        timestamp,
      });
      console.log(`[${category}] Got ${symbol}: price=${price.toFixed(2)}, ma20=${ma20.toFixed(2)}, rsi=${rsi.toFixed(1)}`);
    } else {
      console.warn(`[${category}] Missing data for ${symbol}: price=${price !== undefined}, ma20=${ma20 !== undefined}, rsi=${rsi !== undefined}`);
    }
  }

  console.log(`[${category}] Batch complete: ${results.length}/${symbols.length} symbols, cache hits: ${totalCacheHits}/3`);
  return { data: results, cacheHits: totalCacheHits, staleAssets };
}

// Batch fetch for forex (3 API calls instead of 12)
export async function fetchForexData(
  tickers: readonly ForexTicker[],
  apiKey: string
): Promise<TwelveDataFetchResult> {
  return fetchBatchData([...tickers], apiKey, "Forex");
}

// Batch fetch for stocks (3 API calls instead of 24)
export async function fetchStockData(
  tickers: readonly StockTicker[],
  apiKey: string
): Promise<TwelveDataFetchResult> {
  const keyStocks = (tickers.length > 0 ? tickers : STOCK_KEY_TICKERS).slice(0, 8);
  return fetchBatchData([...keyStocks], apiKey, "Stocks");
}
