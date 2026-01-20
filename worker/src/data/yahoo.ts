// Yahoo Finance API for direct DXY and VIX access
// No API key required - uses public unauthenticated endpoint

import { cachedFetch, DEFAULT_TTL } from "../cache";

const YAHOO_API = "https://query1.finance.yahoo.com/v8/finance/chart";

// Yahoo Finance chart response structure
interface YahooChartResponse {
  chart: {
    result?: Array<{
      meta: {
        regularMarketPrice?: number;
        previousClose?: number;
        symbol: string;
      };
      timestamp?: number[];
      indicators: {
        quote: Array<{
          close: (number | null)[];
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
        }>;
      };
    }>;
    error?: {
      code: string;
      description: string;
    };
  };
}

// Fetch DXY (US Dollar Index) with 20-day MA
export async function fetchDXY(): Promise<{
  price: number;
  ma20: number;
  cached: boolean;
  cachedAt?: string;
}> {
  const symbol = "DX-Y.NYB"; // DXY futures on Yahoo
  const url = `${YAHOO_API}/${encodeURIComponent(symbol)}?interval=1d&range=1mo`;

  try {
    const { data, cached, cachedAt } = await cachedFetch<YahooChartResponse>(
      url,
      DEFAULT_TTL.YAHOO_FINANCE
    );

    if (data.chart.error) {
      console.warn(`[Yahoo] DXY error: ${data.chart.error.description}`);
      return { price: 104, ma20: 104, cached }; // Typical DXY level
    }

    const result = data.chart.result?.[0];
    if (!result) {
      console.warn("[Yahoo] No DXY result");
      return { price: 104, ma20: 104, cached };
    }

    // Get current price from meta
    const price = result.meta.regularMarketPrice ?? result.meta.previousClose;
    if (!price || !Number.isFinite(price)) {
      console.warn("[Yahoo] Invalid DXY price");
      return { price: 104, ma20: 104, cached };
    }

    // Calculate 20-day MA from close prices
    const closes = result.indicators.quote[0]?.close ?? [];
    const validCloses = closes
      .filter((c): c is number => c !== null && Number.isFinite(c) && c > 0)
      .slice(-20); // Get last 20 days

    const ma20 =
      validCloses.length >= 10
        ? validCloses.reduce((sum, c) => sum + c, 0) / validCloses.length
        : price;

    console.log(`[Yahoo] DXY: ${price.toFixed(2)}, MA20: ${ma20.toFixed(2)}, cached: ${cached}`);
    return { price, ma20, cached, cachedAt };
  } catch (error) {
    console.warn("[Yahoo] DXY fetch error:", error);
    return { price: 104, ma20: 104, cached: false };
  }
}

// Fetch VIX (CBOE Volatility Index)
export async function fetchVIX(): Promise<{
  vix: number;
  cached: boolean;
}> {
  const symbol = "^VIX";
  const url = `${YAHOO_API}/${encodeURIComponent(symbol)}?interval=1d&range=5d`;

  try {
    const { data, cached } = await cachedFetch<YahooChartResponse>(
      url,
      DEFAULT_TTL.YAHOO_FINANCE
    );

    if (data.chart.error) {
      console.warn(`[Yahoo] VIX error: ${data.chart.error.description}`);
      return { vix: 20, cached }; // Typical VIX level
    }

    const result = data.chart.result?.[0];
    if (!result) {
      console.warn("[Yahoo] No VIX result");
      return { vix: 20, cached };
    }

    // Get current VIX from meta
    const vix = result.meta.regularMarketPrice ?? result.meta.previousClose;
    if (!vix || !Number.isFinite(vix) || vix <= 0) {
      console.warn("[Yahoo] Invalid VIX value");
      return { vix: 20, cached };
    }

    console.log(`[Yahoo] VIX: ${vix.toFixed(2)}, cached: ${cached}`);
    return { vix, cached };
  } catch (error) {
    console.warn("[Yahoo] VIX fetch error:", error);
    return { vix: 20, cached: false };
  }
}
