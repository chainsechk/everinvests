// src/lib/i18n.ts
// Formatting utilities for internationalized content (dates, numbers, currency)
// For translations, use src/i18n/index.ts

// Re-export core i18n utilities from the main module
export {
  type Locale,
  locales,
  defaultLocale,
  localeNames,
  getLocaleFromUrl,
  getDirection,
  l,
  t,
  useTranslations,
  isValidLocale,
  getAlternateUrls,
} from "../i18n";

import { type Locale, defaultLocale } from "../i18n";

// Backwards compatibility alias
export const DEFAULT_LOCALE = defaultLocale;
export const SUPPORTED_LOCALES = ["en", "es", "zh", "ar", "pt"] as const;

/**
 * Format a date for display
 * Centralizes date formatting to enable locale switching
 */
export function formatDate(
  date: Date | string,
  locale: Locale = defaultLocale,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric"
  }
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  // Map our locale to Intl locale code
  const intlLocale = localeToIntl(locale);
  return d.toLocaleDateString(intlLocale, options);
}

/**
 * Format a date with full weekday
 */
export function formatDateFull(
  date: Date | string,
  locale: Locale = defaultLocale
): string {
  return formatDate(date, locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Format a date as short (Jan 23, 2026)
 */
export function formatDateShort(
  date: Date | string,
  locale: Locale = defaultLocale
): string {
  return formatDate(date, locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format time for display
 */
export function formatTime(
  date: Date | string,
  locale: Locale = defaultLocale,
  options: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const intlLocale = localeToIntl(locale);
  return d.toLocaleTimeString(intlLocale, options);
}

/**
 * Format a number with locale-appropriate separators
 */
export function formatNumber(
  num: number,
  locale: Locale = defaultLocale,
  options?: Intl.NumberFormatOptions
): string {
  const intlLocale = localeToIntl(locale);
  return num.toLocaleString(intlLocale, options);
}

/**
 * Format currency
 */
export function formatCurrency(
  amount: number,
  currency: string = "USD",
  locale: Locale = defaultLocale
): string {
  const intlLocale = localeToIntl(locale);
  return amount.toLocaleString(intlLocale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Format price with appropriate precision
 * Small values (< 1) get more decimal places
 */
export function formatPrice(
  price: number,
  locale: Locale = defaultLocale
): string {
  const intlLocale = localeToIntl(locale);

  // Determine appropriate precision
  let minFrac = 2;
  let maxFrac = 2;

  if (price < 0.01) {
    maxFrac = 6;
  } else if (price < 1) {
    maxFrac = 4;
  } else if (price >= 10000) {
    minFrac = 0;
    maxFrac = 0;
  }

  return price.toLocaleString(intlLocale, {
    minimumFractionDigits: minFrac,
    maximumFractionDigits: maxFrac,
  });
}

/**
 * Format relative time (e.g., "2 hours ago")
 * Uses Intl.RelativeTimeFormat when available
 */
export function formatRelativeTime(
  date: Date | string,
  locale: Locale = defaultLocale
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  const intlLocale = localeToIntl(locale);
  const rtf = new Intl.RelativeTimeFormat(intlLocale, { numeric: "auto" });

  if (diffDay > 0) {
    return rtf.format(-diffDay, "day");
  } else if (diffHour > 0) {
    return rtf.format(-diffHour, "hour");
  } else if (diffMin > 0) {
    return rtf.format(-diffMin, "minute");
  } else {
    return rtf.format(-diffSec, "second");
  }
}

/**
 * Map our locale codes to Intl locale codes
 * Allows for regional variants (e.g., es -> es-ES, pt -> pt-BR)
 */
function localeToIntl(locale: Locale): string {
  const mapping: Record<Locale, string> = {
    en: "en-US",
    es: "es-ES",
    zh: "zh-CN",
    ar: "ar-SA",
    pt: "pt-BR",
    fr: "fr-FR",
    de: "de-DE",
    ja: "ja-JP",
    ko: "ko-KR",
    ru: "ru-RU",
    hi: "hi-IN",
    id: "id-ID",
    tr: "tr-TR",
    vi: "vi-VN",
    it: "it-IT",
  };
  return mapping[locale] || locale;
}
