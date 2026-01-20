// Crypto data fetcher with CoinGecko primary and CoinCap fallback
// Binance funding rate as secondary indicator (optional)

import type { AssetData, CryptoTicker } from "../types";
import { cachedFetch, DEFAULT_TTL, getTimestampAgeMinutes } from "../cache";

const COINGECKO_API = "https://api.coingecko.com/api/v3";
const COINCAP_API = "https://api.coincap.io/v2";
const BINANCE_FUTURES_API = "https://fapi.binance.com";

// Longer timeout for crypto API calls (25 seconds)
const CRYPTO_TIMEOUT_MS = 25000;

// Map our ticker symbols to API IDs
const COINGECKO_IDS: Record<CryptoTicker, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
};

const COINCAP_IDS: Record<CryptoTicker, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
};

interface CoinGeckoOHLC {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

// Get OHLC data from CoinGecko (30 days of 4-hour candles) with caching
async function getOHLCData(coinId: string): Promise<{ ohlc: CoinGeckoOHLC[]; cached: boolean; cachedAt?: string }> {
  const url = `${COINGECKO_API}/coins/${coinId}/ohlc?vs_currency=usd&days=30`;

  const { data, cached, cachedAt } = await cachedFetch<number[][]>(
    url,
    DEFAULT_TTL.COINGECKO_OHLC,
    {
      headers: {
        "User-Agent": "EverInvests/1.0 (https://everinvests.com)",
        "Accept": "application/json",
      },
    },
    CRYPTO_TIMEOUT_MS
  );

  const ohlc = data.map(([timestamp, open, high, low, close]) => ({
    timestamp,
    open,
    high,
    low,
    close,
  }));

  return { ohlc, cached, cachedAt };
}

// Calculate price and 20-day MA from OHLC data
function calculatePriceAndMA(ohlc: CoinGeckoOHLC[]): { price: number; ma20: number } {
  if (ohlc.length === 0) {
    throw new Error("No OHLC data available");
  }

  // Current price is the close of the most recent candle
  const price = ohlc[ohlc.length - 1].close;

  // Get daily closes for MA calculation (last 20 days)
  // CoinGecko returns 4-hour candles, so we need to sample daily closes
  const dailyCloses: number[] = [];
  const msPerDay = 24 * 60 * 60 * 1000;
  let lastDay = -1;

  for (const candle of ohlc) {
    const day = Math.floor(candle.timestamp / msPerDay);
    if (day !== lastDay) {
      dailyCloses.push(candle.close);
      lastDay = day;
    }
  }

  // Take last 20 days (or fewer if not available)
  const recentCloses = dailyCloses.slice(-21, -1); // Exclude current day
  const ma20 = recentCloses.length > 0
    ? recentCloses.reduce((sum, c) => sum + c, 0) / recentCloses.length
    : price;

  return { price, ma20 };
}

// ============================================================
// CoinCap Fallback (more permissive with cloud provider IPs)
// ============================================================

interface CoinCapAsset {
  id: string;
  priceUsd: string;
}

interface CoinCapHistory {
  priceUsd: string;
  time: number;
}

// Get current price from CoinCap
async function getCoinCapPrice(assetId: string): Promise<{ price: number; cached: boolean; cachedAt?: string }> {
  const url = `${COINCAP_API}/assets/${assetId}`;
  const { data, cached, cachedAt } = await cachedFetch<{ data: CoinCapAsset }>(
    url,
    DEFAULT_TTL.COINGECKO_OHLC, // Reuse same TTL
    {
      headers: {
        "Accept": "application/json",
      },
    },
    CRYPTO_TIMEOUT_MS
  );

  const price = parseFloat(data.data.priceUsd);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Invalid CoinCap price for ${assetId}`);
  }

  return { price, cached, cachedAt };
}

// Get 20-day MA from CoinCap history
async function getCoinCapMA20(assetId: string): Promise<{ ma20: number; cached: boolean }> {
  // Get last 25 days of daily data
  const end = Date.now();
  const start = end - 25 * 24 * 60 * 60 * 1000;
  const url = `${COINCAP_API}/assets/${assetId}/history?interval=d1&start=${start}&end=${end}`;

  const { data, cached } = await cachedFetch<{ data: CoinCapHistory[] }>(
    url,
    DEFAULT_TTL.COINGECKO_OHLC,
    {
      headers: {
        "Accept": "application/json",
      },
    },
    CRYPTO_TIMEOUT_MS
  );

  if (!data.data || data.data.length < 15) {
    throw new Error(`Insufficient CoinCap history for ${assetId}`);
  }

  // Calculate 20-day MA from the most recent 20 days (exclude today)
  const prices = data.data.slice(-21, -1).map(d => parseFloat(d.priceUsd));
  const validPrices = prices.filter(p => Number.isFinite(p) && p > 0);

  if (validPrices.length < 15) {
    throw new Error(`Invalid CoinCap MA data for ${assetId}`);
  }

  const ma20 = validPrices.reduce((sum, p) => sum + p, 0) / validPrices.length;
  return { ma20, cached };
}

// Fetch price and MA from CoinCap (fallback)
async function fetchFromCoinCap(
  ticker: CryptoTicker
): Promise<{ price: number; ma20: number; cached: boolean; cachedAt?: string }> {
  const assetId = COINCAP_IDS[ticker];
  if (!assetId) {
    throw new Error(`Unknown CoinCap ticker: ${ticker}`);
  }

  const [priceResult, maResult] = await Promise.all([
    getCoinCapPrice(assetId),
    getCoinCapMA20(assetId),
  ]);

  return {
    price: priceResult.price,
    ma20: maResult.ma20,
    cached: priceResult.cached && maResult.cached,
    cachedAt: priceResult.cachedAt,
  };
}

// Fetch timeout for direct API calls (15 seconds)
const FETCH_TIMEOUT_MS = 15000;

// Get funding rate from Binance (optional, returns 0 on failure)
// Note: Binance Futures API may block cloud provider IPs (Cloudflare Workers, AWS, etc.)
async function getFundingRate(symbol: string): Promise<number> {
  try {
    const url = `${BINANCE_FUTURES_API}/fapi/v1/fundingRate?symbol=${symbol}USDT&limit=1`;

    // Use AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "EverInvests/1.0 (https://everinvests.com)",
          "Accept": "application/json",
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        // 403 is common when Binance blocks cloud provider IPs - this is expected
        console.warn(`Binance funding rate unavailable for ${symbol}: ${res.status}`);
        return 0;
      }

      const data = await res.json() as Array<{ fundingRate: string }>;
      if (!data || data.length === 0) return 0;

      return parseFloat(data[0].fundingRate);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.warn(`Binance funding rate failed for ${symbol}: ${errMsg}`);
    return 0;
  }
}

// Stale threshold in minutes (data older than this is considered stale)
const STALE_THRESHOLD_MINUTES = 30;

export interface CryptoFetchResult {
  data: AssetData[];
  cacheHits: number;
  staleAssets: string[];
}

export async function fetchCryptoData(tickers: readonly CryptoTicker[]): Promise<CryptoFetchResult> {
  const results: AssetData[] = [];
  const timestamp = new Date().toISOString();
  let totalCacheHits = 0;
  const staleAssets: string[] = [];

  console.log(`[Crypto] Fetching ${tickers.length} assets`);

  for (const ticker of tickers) {
    try {
      let price: number;
      let ma20: number;
      let cached = false;
      let cachedAt: string | undefined;
      let source = "coingecko";

      const coinId = COINGECKO_IDS[ticker];
      if (!coinId) {
        console.error(`Unknown ticker: ${ticker}`);
        continue;
      }

      // Try CoinGecko first
      try {
        const [ohlcResult, fundingRate] = await Promise.all([
          getOHLCData(coinId),
          getFundingRate(ticker),
        ]);

        const priceData = calculatePriceAndMA(ohlcResult.ohlc);
        price = priceData.price;
        ma20 = priceData.ma20;
        cached = ohlcResult.cached;
        cachedAt = ohlcResult.cachedAt;

        results.push({
          ticker,
          price,
          ma20,
          secondaryIndicator: fundingRate,
          timestamp,
        });
      } catch (geckoError) {
        // CoinGecko failed, try CoinCap fallback
        const geckoMsg = geckoError instanceof Error ? geckoError.message : String(geckoError);
        console.warn(`[Crypto] CoinGecko failed for ${ticker}: ${geckoMsg}, trying CoinCap...`);

        try {
          const [capResult, fundingRate] = await Promise.all([
            fetchFromCoinCap(ticker),
            getFundingRate(ticker),
          ]);

          price = capResult.price;
          ma20 = capResult.ma20;
          cached = capResult.cached;
          cachedAt = capResult.cachedAt;
          source = "coincap";

          results.push({
            ticker,
            price,
            ma20,
            secondaryIndicator: fundingRate,
            timestamp,
          });

          console.log(`[Crypto] CoinCap fallback succeeded for ${ticker}`);
        } catch (capError) {
          const capMsg = capError instanceof Error ? capError.message : String(capError);
          console.error(`[Crypto] Both sources failed for ${ticker}: CoinGecko: ${geckoMsg}, CoinCap: ${capMsg}`);
          continue;
        }
      }

      if (cached) {
        totalCacheHits++;
        if (cachedAt) {
          const ageMinutes = getTimestampAgeMinutes(cachedAt);
          if (ageMinutes > STALE_THRESHOLD_MINUTES) {
            staleAssets.push(ticker);
          }
        }
      }

      // Rate limiting delay only for fresh API calls
      if (!cached) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log(`[Crypto] Fetched ${ticker} from ${source} (cached: ${cached})`);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Crypto] Unexpected error for ${ticker}: ${errMsg}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`[Crypto] Cache hits: ${totalCacheHits}, Stale: ${staleAssets.length}, Total: ${results.length}`);
  return { data: results, cacheHits: totalCacheHits, staleAssets };
}
