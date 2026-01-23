// src/lib/i18n.ts
// Internationalization utilities - platform layer for i18n-ready code

export const DEFAULT_LOCALE = "en";
export const SUPPORTED_LOCALES = ["en"] as const; // Extend when adding languages
export type Locale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Get the current locale from URL path or default
 * Future: will extract from /[lang]/... path segments
 */
export function getLocale(pathname?: string): Locale {
  // For now, always return default locale
  // Future implementation will parse /{lang}/ from pathname
  return DEFAULT_LOCALE;
}

/**
 * Build a localized path
 * When locale === DEFAULT_LOCALE, returns path as-is
 * Otherwise prepends /{locale}/ prefix
 *
 * @example
 * l("/crypto") // => "/crypto" (default locale)
 * l("/crypto", "es") // => "/es/crypto" (future)
 */
export function l(path: string, locale: Locale = DEFAULT_LOCALE): string {
  // Ensure path starts with /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  // Default locale doesn't get prefix (cleaner URLs)
  if (locale === DEFAULT_LOCALE) {
    return normalizedPath;
  }

  // Non-default locales get /{locale} prefix
  return `/${locale}${normalizedPath}`;
}

/**
 * Format a date for display
 * Centralizes date formatting to enable locale switching
 */
export function formatDate(
  date: Date | string,
  locale: Locale = DEFAULT_LOCALE,
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
  locale: Locale = DEFAULT_LOCALE
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
  locale: Locale = DEFAULT_LOCALE
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
  locale: Locale = DEFAULT_LOCALE,
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
  locale: Locale = DEFAULT_LOCALE,
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
  locale: Locale = DEFAULT_LOCALE
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
  locale: Locale = DEFAULT_LOCALE
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
  locale: Locale = DEFAULT_LOCALE
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
  const mapping: Record<string, string> = {
    en: "en-US",
    // Future locales:
    // es: "es-ES",
    // zh: "zh-CN",
    // fr: "fr-FR",
    // de: "de-DE",
    // ja: "ja-JP",
    // pt: "pt-BR",
    // ru: "ru-RU",
    // ar: "ar-SA",
    // hi: "hi-IN",
    // ko: "ko-KR",
    // it: "it-IT",
    // tr: "tr-TR",
    // pl: "pl-PL",
    // vi: "vi-VN",
    // bn: "bn-BD",
  };
  return mapping[locale] || locale;
}

/**
 * Get text direction for a locale
 */
export function getDirection(locale: Locale): "ltr" | "rtl" {
  const rtlLocales = ["ar", "he", "fa", "ur"];
  return rtlLocales.includes(locale) ? "rtl" : "ltr";
}
