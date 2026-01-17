// Crypto data fetcher using CoinGecko API (reliable with Cloudflare Workers)
// Binance funding rate as secondary indicator (optional fallback)

import type { AssetData, CryptoTicker } from "../types";

const COINGECKO_API = "https://api.coingecko.com/api/v3";
const BINANCE_FUTURES_API = "https://fapi.binance.com";

// Map our ticker symbols to CoinGecko IDs
const COINGECKO_IDS: Record<CryptoTicker, string> = {
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

// Get OHLC data from CoinGecko (30 days of 4-hour candles)
async function getOHLCData(coinId: string): Promise<CoinGeckoOHLC[]> {
  const url = `${COINGECKO_API}/coins/${coinId}/ohlc?vs_currency=usd&days=30`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "EverInvests/1.0 (https://everinvests.com)",
      "Accept": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CoinGecko OHLC failed: ${res.status} - ${text.slice(0, 100)}`);
  }

  const data = await res.json() as number[][];
  return data.map(([timestamp, open, high, low, close]) => ({
    timestamp,
    open,
    high,
    low,
    close,
  }));
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

// Get funding rate from Binance (optional, returns 0 on failure)
// Note: Binance Futures API may block cloud provider IPs (Cloudflare Workers, AWS, etc.)
async function getFundingRate(symbol: string): Promise<number> {
  try {
    const url = `${BINANCE_FUTURES_API}/fapi/v1/fundingRate?symbol=${symbol}USDT&limit=1`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "EverInvests/1.0 (https://everinvests.com)",
        "Accept": "application/json",
      },
    });

    if (!res.ok) {
      // 403 is common when Binance blocks cloud provider IPs - this is expected
      console.warn(`Binance funding rate unavailable for ${symbol}: ${res.status}`);
      return 0;
    }

    const data = await res.json() as Array<{ fundingRate: string }>;
    if (!data || data.length === 0) return 0;

    return parseFloat(data[0].fundingRate);
  } catch (error) {
    console.warn(`Binance funding rate failed for ${symbol}:`, error);
    return 0;
  }
}

export async function fetchCryptoData(tickers: readonly CryptoTicker[]): Promise<AssetData[]> {
  const results: AssetData[] = [];
  const timestamp = new Date().toISOString();

  for (const ticker of tickers) {
    try {
      const coinId = COINGECKO_IDS[ticker];
      if (!coinId) {
        console.error(`Unknown ticker: ${ticker}`);
        continue;
      }

      // Fetch price data from CoinGecko and funding rate from Binance in parallel
      const [ohlc, fundingRate] = await Promise.all([
        getOHLCData(coinId),
        getFundingRate(ticker),
      ]);

      const { price, ma20 } = calculatePriceAndMA(ohlc);

      results.push({
        ticker,
        price,
        ma20,
        secondaryIndicator: fundingRate,
        timestamp,
      });

      // CoinGecko rate limit: 10-30 calls/min (free tier)
      // Add small delay between requests
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Crypto] Failed to fetch ${ticker}: ${errMsg}`);
    }
  }

  return results;
}
