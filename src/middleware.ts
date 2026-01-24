// src/middleware.ts
// Astro middleware for SSR caching and request processing

import { defineMiddleware } from "astro:middleware";
import { locales, defaultLocale, isValidLocale, l } from "./i18n";
import type { Locale } from "./i18n";

// Cookie name for explicit language preference
const LOCALE_COOKIE = "locale-pref";

// Bot User-Agent patterns (don't redirect crawlers - let them index all versions)
const BOT_PATTERNS = /bot|crawl|spider|slurp|googlebot|bingbot|yandex|baidu|duckduck/i;

/**
 * Parse Accept-Language header and return best matching locale
 * Example: "es-ES,es;q=0.9,en;q=0.8" -> "es"
 */
function parseAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;

  // Parse into sorted list of language codes by quality
  const languages = header
    .split(",")
    .map((part) => {
      const [lang, qPart] = part.trim().split(";");
      const q = qPart ? parseFloat(qPart.split("=")[1]) : 1;
      // Extract base language code (en-US -> en)
      const code = lang.split("-")[0].toLowerCase();
      return { code, q };
    })
    .sort((a, b) => b.q - a.q);

  // Find first match in our supported locales
  for (const { code } of languages) {
    if (isValidLocale(code)) {
      return code as Locale;
    }
  }

  return null;
}

/**
 * Check if URL already has a locale prefix
 */
function getLocaleFromPath(pathname: string): Locale | null {
  const [, segment] = pathname.split("/");
  if (segment && isValidLocale(segment)) {
    return segment as Locale;
  }
  return null;
}

/**
 * Get cookie value from request
 */
function getCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

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
  // Historical signal pages: /crypto/2026-01-23/08:00 - long TTL (never changes)
  { pattern: /^\/(crypto|forex|stocks)\/\d{4}-\d{2}-\d{2}\/\d{2}:\d{2}$/, ttl: 604800 }, // 1 week

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
  const request = context.request;

  // Skip API routes and OG image routes - they set their own headers
  if (pathname.startsWith("/api/") || pathname.startsWith("/og/")) {
    return next();
  }

  // Skip static assets
  if (pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) {
    return next();
  }

  // --- Language Detection & Redirect ---
  const urlLocale = getLocaleFromPath(pathname);
  const userAgent = request.headers.get("User-Agent") || "";
  const isBot = BOT_PATTERNS.test(userAgent);

  // Only consider redirecting if:
  // 1. URL has no locale prefix (user is on default English route)
  // 2. Not a bot/crawler (let them index all versions)
  if (!urlLocale && !isBot) {
    const cookieHeader = request.headers.get("Cookie");
    const savedLocale = getCookie(cookieHeader, LOCALE_COOKIE);

    // Check if user has explicit preference saved
    if (savedLocale && isValidLocale(savedLocale) && savedLocale !== defaultLocale) {
      // User previously chose a non-default locale, redirect them
      const redirectUrl = new URL(l(pathname, savedLocale as Locale), context.url.origin);
      redirectUrl.search = context.url.search; // Preserve query params
      return Response.redirect(redirectUrl.toString(), 302);
    }

    // No saved preference - check Accept-Language header
    if (!savedLocale) {
      const acceptLang = request.headers.get("Accept-Language");
      const preferredLocale = parseAcceptLanguage(acceptLang);

      if (preferredLocale && preferredLocale !== defaultLocale) {
        // Browser prefers a non-default locale we support
        const redirectUrl = new URL(l(pathname, preferredLocale), context.url.origin);
        redirectUrl.search = context.url.search;

        // Set cookie so we don't keep redirecting on every page
        const response = Response.redirect(redirectUrl.toString(), 302);
        // Note: We can't set cookies on redirect responses in all environments
        // The language switcher will set the cookie when user explicitly changes
        return response;
      }
    }
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
