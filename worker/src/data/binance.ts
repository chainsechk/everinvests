// Binance API for crypto data (BTC, ETH)
// Free, no API key required for public endpoints

import type { AssetData, CryptoTicker } from "../types";

const BINANCE_API = "https://api.binance.com";

interface BinanceKline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
}

interface BinanceFundingRate {
  symbol: string;
  fundingRate: string;
  fundingTime: number;
}

// Get current price and 20-day MA
async function getPriceAndMA(symbol: string): Promise<{ price: number; ma20: number }> {
  // Get last 21 daily klines (need 20 for MA + current)
  const url = `${BINANCE_API}/api/v3/klines?symbol=${symbol}USDT&interval=1d&limit=21`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Binance klines failed: ${res.status}`);
  }

  const rawKlines = await res.json() as any[];
  const klines: BinanceKline[] = rawKlines.map((k: any[]) => ({
    openTime: k[0],
    open: k[1],
    high: k[2],
    low: k[3],
    close: k[4],
    volume: k[5],
    closeTime: k[6],
  }));

  // Current price is the close of the last kline
  const price = parseFloat(klines[klines.length - 1].close);

  // 20-day MA from the previous 20 closes (excluding current)
  const closes = klines.slice(0, 20).map(k => parseFloat(k.close));
  const ma20 = closes.reduce((sum, c) => sum + c, 0) / 20;

  return { price, ma20 };
}

// Get funding rate (perpetual futures)
async function getFundingRate(symbol: string): Promise<number> {
  const url = `${BINANCE_API}/fapi/v1/fundingRate?symbol=${symbol}USDT&limit=1`;
  const res = await fetch(url);

  if (!res.ok) {
    // Funding rate might not be available, return 0
    console.warn(`Binance funding rate failed for ${symbol}: ${res.status}`);
    return 0;
  }

  const data: BinanceFundingRate[] = await res.json();
  if (data.length === 0) return 0;

  return parseFloat(data[0].fundingRate);
}

export async function fetchCryptoData(tickers: readonly CryptoTicker[]): Promise<AssetData[]> {
  const results: AssetData[] = [];
  const timestamp = new Date().toISOString();

  for (const ticker of tickers) {
    try {
      const [priceData, fundingRate] = await Promise.all([
        getPriceAndMA(ticker),
        getFundingRate(ticker),
      ]);

      results.push({
        ticker,
        price: priceData.price,
        ma20: priceData.ma20,
        secondaryIndicator: fundingRate,
        timestamp,
      });
    } catch (error) {
      console.error(`Failed to fetch ${ticker}:`, error);
      // Continue with other tickers
    }
  }

  return results;
}
