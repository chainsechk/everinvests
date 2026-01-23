// src/middleware.ts
// Astro middleware for SSR caching and request processing

import { defineMiddleware } from "astro:middleware";

// Cache TTL configuration (in seconds)
const CACHE_CONFIG: Record<string, number> = {
  // Category landing pages - short TTL (updates 3x/day)
  "/crypto": 300, // 5 min
  "/forex": 300,
  "/stocks": 300,

  // History pages - medium TTL
  "/crypto/history": 3600, // 1 hour
  "/forex/history": 3600,
  "/stocks/history": 3600,

  // Static content pages - long TTL
  "/about": 86400, // 1 day
  "/terms": 86400,
  "/performance": 3600, // 1 hour (updates daily)
  "/blog": 3600,

  // Homepage
  "/": 300, // 5 min
};

// Pattern-based cache rules
const CACHE_PATTERNS: Array<{ pattern: RegExp; ttl: number }> = [
  // Historical signal pages: /crypto/2026-01-23/0800 - long TTL (never changes)
  { pattern: /^\/(crypto|forex|stocks)\/\d{4}-\d{2}-\d{2}\/\d{4}$/, ttl: 604800 }, // 1 week

  // Ticker/pair pages: /crypto/BTC, /forex/USD-JPY
  { pattern: /^\/(crypto|forex|stocks)\/[A-Z-]+$/, ttl: 300 }, // 5 min

  // Learn pages - long TTL
  { pattern: /^\/learn\//, ttl: 86400 }, // 1 day

  // Guide pages - long TTL
  { pattern: /^\/guides\//, ttl: 86400 },

  // Blog posts - long TTL
  { pattern: /^\/blog\/[^/]+$/, ttl: 86400 },

  // Embed pages - short TTL
  { pattern: /^\/embed/, ttl: 300 },
];

function getCacheTTL(pathname: string): number | null {
  // Check exact matches first
  if (CACHE_CONFIG[pathname] !== undefined) {
    return CACHE_CONFIG[pathname];
  }

  // Check patterns
  for (const { pattern, ttl } of CACHE_PATTERNS) {
    if (pattern.test(pathname)) {
      return ttl;
    }
  }

  // No caching for unmatched routes (API, OG images handle their own)
  return null;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Skip API routes and OG image routes - they set their own headers
  if (pathname.startsWith("/api/") || pathname.startsWith("/og/")) {
    return next();
  }

  // Get response from the route
  const response = await next();

  // Determine cache TTL for this route
  const ttl = getCacheTTL(pathname);

  // If no TTL configured, return response as-is
  if (ttl === null) {
    return response;
  }

  // Clone response and add Cache-Control header
  const newHeaders = new Headers(response.headers);

  // Only set if not already set by the page
  if (!newHeaders.has("Cache-Control")) {
    newHeaders.set("Cache-Control", `public, max-age=${ttl}, s-maxage=${ttl}`);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
});
