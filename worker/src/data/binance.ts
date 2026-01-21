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

interface CoinGeckoMarketChart {
  prices: [number, number][];       // [timestamp, price]
  total_volumes: [number, number][]; // [timestamp, volume]
}

// Get market chart data from CoinGecko (30 days of prices + volumes) with caching
async function getMarketChartData(coinId: string): Promise<{ chart: CoinGeckoMarketChart; cached: boolean; cachedAt?: string }> {
  const url = `${COINGECKO_API}/coins/${coinId}/market_chart?vs_currency=usd&days=30`;

  const { data, cached, cachedAt } = await cachedFetch<CoinGeckoMarketChart>(
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

  return { chart: data, cached, cachedAt };
}

// Calculate price, MA20, volume, avgVolume, and BBW from market chart data
function calculatePriceAndVolume(chart: CoinGeckoMarketChart): {
  price: number;
  ma20: number;
  volume: number;
  avgVolume: number;
  bbWidth?: number;
} {
  if (!chart.prices || chart.prices.length === 0) {
    throw new Error("No price data available");
  }

  // Current price is the most recent price point
  const price = chart.prices[chart.prices.length - 1][1];

  // Get daily prices for MA calculation
  const dailyPrices: number[] = [];
  const msPerDay = 24 * 60 * 60 * 1000;
  let lastDay = -1;

  for (const [timestamp, pricePoint] of chart.prices) {
    const day = Math.floor(timestamp / msPerDay);
    if (day !== lastDay) {
      dailyPrices.push(pricePoint);
      lastDay = day;
    }
  }

  // Take last 20 days (or fewer if not available), excluding current day
  const recentPrices = dailyPrices.slice(-21, -1);
  const closes20 = recentPrices.slice(-20);

  const ma20 = closes20.length > 0
    ? closes20.reduce((sum, c) => sum + c, 0) / closes20.length
    : price;

  // Calculate Bollinger Band Width (BBW) = (Upper - Lower) / Middle = (4 * stdDev) / ma20
  let bbWidth: number | undefined;
  if (closes20.length >= 20 && ma20 > 0) {
    const variance = closes20.reduce((sum, c) => sum + Math.pow(c - ma20, 2), 0) / 20;
    const stdDev = Math.sqrt(variance);
    bbWidth = (4 * stdDev) / ma20;
  }

  // Current 24h volume is the most recent volume point
  const volume = chart.total_volumes.length > 0
    ? chart.total_volumes[chart.total_volumes.length - 1][1]
    : 0;

  // Calculate 7-day average volume
  const dailyVolumes: number[] = [];
  lastDay = -1;
  for (const [timestamp, vol] of chart.total_volumes) {
    const day = Math.floor(timestamp / msPerDay);
    if (day !== lastDay) {
      dailyVolumes.push(vol);
      lastDay = day;
    }
  }

  // Use last 7 days excluding today for average
  const recentVolumes = dailyVolumes.slice(-8, -1);
  const avgVolume = recentVolumes.length > 0
    ? recentVolumes.reduce((sum, v) => sum + v, 0) / recentVolumes.length
    : volume;

  return { price, ma20, volume, avgVolume, bbWidth };
}

// ============================================================
// CoinCap Fallback (more permissive with cloud provider IPs)
// ============================================================

interface CoinCapAsset {
  id: string;
  priceUsd: string;
  volumeUsd24Hr: string;
}

interface CoinCapHistory {
  priceUsd: string;
  time: number;
}

// Get current price and volume from CoinCap
async function getCoinCapPriceAndVolume(assetId: string): Promise<{
  price: number;
  volume: number;
  cached: boolean;
  cachedAt?: string;
}> {
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
  const volume = parseFloat(data.data.volumeUsd24Hr);

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Invalid CoinCap price for ${assetId}`);
  }

  return {
    price,
    volume: Number.isFinite(volume) ? volume : 0,
    cached,
    cachedAt,
  };
}

// Get 20-day MA and BBW from CoinCap history (no volume history available)
async function getCoinCapMA(assetId: string): Promise<{ ma20: number; bbWidth?: number; cached: boolean }> {
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

  // Calculate MA20 from the most recent days (exclude today)
  const prices = data.data.slice(-21, -1).map(d => parseFloat(d.priceUsd));
  const validPrices = prices.filter(p => Number.isFinite(p) && p > 0);

  if (validPrices.length < 10) {
    throw new Error(`Invalid CoinCap MA data for ${assetId}`);
  }

  const prices20 = validPrices.slice(-20);
  const ma20 = prices20.reduce((sum, p) => sum + p, 0) / prices20.length;

  // Calculate Bollinger Band Width (BBW) = (4 * stdDev) / ma20
  let bbWidth: number | undefined;
  if (prices20.length >= 20 && ma20 > 0) {
    const variance = prices20.reduce((sum, p) => sum + Math.pow(p - ma20, 2), 0) / 20;
    const stdDev = Math.sqrt(variance);
    bbWidth = (4 * stdDev) / ma20;
  }

  return { ma20, bbWidth, cached };
}

// Fetch price, MA, volume, and BBW from CoinCap (fallback)
// Note: CoinCap doesn't provide historical volume, so avgVolume = current volume
async function fetchFromCoinCap(
  ticker: CryptoTicker
): Promise<{
  price: number;
  ma20: number;
  volume: number;
  avgVolume: number;
  bbWidth?: number;
  cached: boolean;
  cachedAt?: string;
}> {
  const assetId = COINCAP_IDS[ticker];
  if (!assetId) {
    throw new Error(`Unknown CoinCap ticker: ${ticker}`);
  }

  const [priceResult, maResult] = await Promise.all([
    getCoinCapPriceAndVolume(assetId),
    getCoinCapMA(assetId),
  ]);

  return {
    price: priceResult.price,
    ma20: maResult.ma20,
    volume: priceResult.volume,
    avgVolume: priceResult.volume, // CoinCap doesn't have historical volume
    bbWidth: maResult.bbWidth,
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
      let volume: number;
      let avgVolume: number;
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
        const [chartResult, fundingRate] = await Promise.all([
          getMarketChartData(coinId),
          getFundingRate(ticker),
        ]);

        const priceData = calculatePriceAndVolume(chartResult.chart);
        price = priceData.price;
        ma20 = priceData.ma20;
        volume = priceData.volume;
        avgVolume = priceData.avgVolume;
        cached = chartResult.cached;
        cachedAt = chartResult.cachedAt;

        results.push({
          ticker,
          price,
          ma20,
          volume,
          avgVolume,
          secondaryIndicator: fundingRate,
          timestamp,
          bbWidth: priceData.bbWidth,
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
          volume = capResult.volume;
          avgVolume = capResult.avgVolume;
          cached = capResult.cached;
          cachedAt = capResult.cachedAt;
          source = "coincap";

          results.push({
            ticker,
            price,
            ma20,
            volume,
            avgVolume,
            secondaryIndicator: fundingRate,
            timestamp,
            bbWidth: capResult.bbWidth,
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
