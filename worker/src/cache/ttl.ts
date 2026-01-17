// TTL cache for API responses using Cloudflare Cache API
// Reduces API rate limit issues by caching frequent requests

export interface CacheConfig {
  // Default TTL values in seconds
  TWELVEDATA_QUOTE: number;
  TWELVEDATA_SMA: number;
  TWELVEDATA_RSI: number;
  ALPHAVANTAGE_SYMBOL: number;
  ALPHAVANTAGE_TREASURY: number;
  MACRO: number;
}

// Default TTL configuration
export const DEFAULT_TTL: CacheConfig = {
  TWELVEDATA_QUOTE: 5 * 60, // 5 minutes for real-time price
  TWELVEDATA_SMA: 15 * 60, // 15 minutes for SMA (daily data)
  TWELVEDATA_RSI: 15 * 60, // 15 minutes for RSI (daily data)
  ALPHAVANTAGE_SYMBOL: 60 * 60, // 1 hour for daily time series
  ALPHAVANTAGE_TREASURY: 60 * 60, // 1 hour for treasury yields
  MACRO: 60 * 60, // 1 hour for macro data (DXY, VIX, Treasury)
};

// Cache key prefix to avoid collisions
const CACHE_PREFIX = "everinvests-api-cache:v1";

// Generate cache key from URL
function getCacheKey(url: string): string {
  return `${CACHE_PREFIX}:${url}`;
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

// Fetch with TTL caching
export async function cachedFetch<T>(
  url: string,
  ttlSeconds: number,
  options?: RequestInit
): Promise<{ data: T; cached: boolean; cachedAt?: string }> {
  const cache = getDefaultCache();
  const cacheKey = getCacheKey(url);
  const cacheRequest = new Request(cacheKey);

  // Try to get from cache
  const cachedResponse = await cache.match(cacheRequest);
  if (cachedResponse) {
    const data = await cachedResponse.json() as T;
    const cachedAt = cachedResponse.headers.get("X-Cached-At") || undefined;
    return { data, cached: true, cachedAt };
  }

  // Fetch fresh data
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as T;

  // Store in cache with TTL
  const cacheResponse = createCacheResponse(data, ttlSeconds);
  await cache.put(cacheRequest, cacheResponse);

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
