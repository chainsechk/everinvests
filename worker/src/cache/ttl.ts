// TTL cache for API responses using Cloudflare Cache API
// Reduces API rate limit issues by caching frequent requests

export interface CacheConfig {
  // Default TTL values in seconds
  TWELVEDATA_QUOTE: number;
  TWELVEDATA_SMA: number;
  TWELVEDATA_RSI: number;
  ALPHAVANTAGE_SYMBOL: number;
  ALPHAVANTAGE_TREASURY: number;
  YAHOO_FINANCE: number;
  MACRO: number;
  COINGECKO_OHLC: number;
}

// Default TTL configuration
export const DEFAULT_TTL: CacheConfig = {
  TWELVEDATA_QUOTE: 5 * 60, // 5 minutes for real-time price
  TWELVEDATA_SMA: 15 * 60, // 15 minutes for SMA (daily data)
  TWELVEDATA_RSI: 15 * 60, // 15 minutes for RSI (daily data)
  ALPHAVANTAGE_SYMBOL: 60 * 60, // 1 hour for daily time series
  ALPHAVANTAGE_TREASURY: 60 * 60, // 1 hour for treasury yields
  YAHOO_FINANCE: 30 * 60, // 30 minutes for Yahoo Finance (DXY, VIX)
  MACRO: 60 * 60, // 1 hour for macro data (Treasury yields)
  COINGECKO_OHLC: 15 * 60, // 15 minutes for OHLC data
};

// Cache key prefix to avoid collisions
const CACHE_PREFIX = "everinvests-api-cache-v1";

// Generate cache key from URL
// Must return a valid URL for the Cloudflare Cache API Request constructor
function getCacheKey(url: string): string {
  // Use a fake domain with the URL encoded to create a valid cache key
  // Strip API keys from the URL to avoid exposing them in cache
  const sanitizedUrl = url.replace(/apikey=[^&]+/, "apikey=REDACTED");
  return `https://cache.everinvests.local/${CACHE_PREFIX}/${encodeURIComponent(sanitizedUrl)}`;
}

// Create a cacheable response with TTL header
function createCacheResponse(data: unknown, ttlSeconds: number): Response {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${ttlSeconds}`,
      "X-Cache-TTL": String(ttlSeconds),
      "X-Cached-At": new Date().toISOString(),
    },
  });
}

// Get the default cache (Cloudflare Workers Cache API)
function getDefaultCache(): Cache {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (caches as any).default as Cache;
}

// Check if response is an API error (TwelveData/AlphaVantage style)
function isApiErrorResponse(data: unknown): boolean {
  if (typeof data !== "object" || data === null) return false;
  // TwelveData errors have { code, message, status: "error" }
  if ("status" in data && (data as { status: string }).status === "error") return true;
  // AlphaVantage errors have { "Error Message": "..." }
  if ("Error Message" in data) return true;
  // Rate limit messages
  if ("Note" in data) return true;
  return false;
}

// Default fetch timeout in milliseconds (20 seconds)
const DEFAULT_FETCH_TIMEOUT_MS = 20000;

// Fetch with timeout using AbortController
async function fetchWithTimeout(
  url: string,
  options?: RequestInit,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Fetch with TTL caching
export async function cachedFetch<T>(
  url: string,
  ttlSeconds: number,
  options?: RequestInit,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS
): Promise<{ data: T; cached: boolean; cachedAt?: string }> {
  const cache = getDefaultCache();
  const cacheKey = getCacheKey(url);
  const cacheRequest = new Request(cacheKey);

  // Try to get from cache
  const cachedResponse = await cache.match(cacheRequest);
  if (cachedResponse) {
    const data = await cachedResponse.json() as T;
    // Don't return cached error responses - delete and fetch fresh
    if (isApiErrorResponse(data)) {
      await cache.delete(cacheRequest);
    } else {
      const cachedAt = cachedResponse.headers.get("X-Cached-At") || undefined;
      return { data, cached: true, cachedAt };
    }
  }

  // Fetch fresh data with timeout
  const response = await fetchWithTimeout(url, options, timeoutMs);
  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as T;

  // Only cache successful responses, not API errors
  if (!isApiErrorResponse(data)) {
    const cacheResponse = createCacheResponse(data, ttlSeconds);
    await cache.put(cacheRequest, cacheResponse);
  }

  return { data, cached: false };
}

// Get remaining TTL for a cached item (for debugging/monitoring)
export async function getCacheTTL(url: string): Promise<number | null> {
  const cache = getDefaultCache();
  const cacheKey = getCacheKey(url);
  const cacheRequest = new Request(cacheKey);

  const cachedResponse = await cache.match(cacheRequest);
  if (!cachedResponse) {
    return null;
  }

  const cachedAt = cachedResponse.headers.get("X-Cached-At");
  const ttl = cachedResponse.headers.get("X-Cache-TTL");

  if (!cachedAt || !ttl) {
    return null;
  }

  const cachedTime = new Date(cachedAt).getTime();
  const ttlMs = parseInt(ttl, 10) * 1000;
  const remaining = Math.max(0, (cachedTime + ttlMs - Date.now()) / 1000);

  return Math.round(remaining);
}

// Invalidate cache for a specific URL
export async function invalidateCache(url: string): Promise<boolean> {
  const cache = getDefaultCache();
  const cacheKey = getCacheKey(url);
  const cacheRequest = new Request(cacheKey);

  return await cache.delete(cacheRequest);
}

// Helper to get timestamp age in minutes
export function getTimestampAgeMinutes(timestamp: string): number {
  const cachedTime = new Date(timestamp).getTime();
  return (Date.now() - cachedTime) / (1000 * 60);
}
