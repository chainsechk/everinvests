// src/i18n/index.ts
// Translation infrastructure for EverInvests

import en from "./locales/en.json";
import es from "./locales/es.json";
import zh from "./locales/zh.json";
import ar from "./locales/ar.json";
import pt from "./locales/pt.json";
import fr from "./locales/fr.json";
import de from "./locales/de.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import ru from "./locales/ru.json";
import hi from "./locales/hi.json";
import id from "./locales/id.json";
import tr from "./locales/tr.json";
import vi from "./locales/vi.json";
import it from "./locales/it.json";

// Supported locales (must match astro.config.mjs)
export const locales = ["en", "es", "zh", "ar", "pt", "fr", "de", "ja", "ko", "ru", "hi", "id", "tr", "vi", "it"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

// RTL languages
const rtlLocales: Locale[] = ["ar"];

// Translation dictionaries
const translations: Record<Locale, Record<string, string>> = {
  en,
  es,
  zh,
  ar,
  pt,
  fr,
  de,
  ja,
  ko,
  ru,
  hi,
  id,
  tr,
  vi,
  it,
};

// Language display names (in their native language)
export const localeNames: Record<Locale, string> = {
  en: "English",
  es: "Español",
  zh: "中文",
  ar: "العربية",
  pt: "Português",
  fr: "Français",
  de: "Deutsch",
  ja: "日本語",
  ko: "한국어",
  ru: "Русский",
  hi: "हिन्दी",
  id: "Bahasa Indonesia",
  tr: "Türkçe",
  vi: "Tiếng Việt",
  it: "Italiano",
};

/**
 * Get text direction for a locale
 */
export function getDirection(locale: Locale): "ltr" | "rtl" {
  return rtlLocales.includes(locale) ? "rtl" : "ltr";
}

/**
 * Extract locale from URL pathname
 * /es/crypto -> "es"
 * /crypto -> "en" (default)
 */
export function getLocaleFromUrl(url: URL): Locale {
  const [, segment] = url.pathname.split("/");
  if (segment && locales.includes(segment as Locale)) {
    return segment as Locale;
  }
  return defaultLocale;
}

/**
 * Get localized path
 * l("/crypto", "es") -> "/es/crypto"
 * l("/crypto", "en") -> "/crypto" (default locale, no prefix)
 */
export function l(path: string, locale: Locale): string {
  if (locale === defaultLocale) {
    return path;
  }
  // Ensure path starts with /
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${normalizedPath}`;
}

/**
 * Translation function
 * t("nav.home", locale) -> "Home" or "Inicio"
 * t("footer.copyright", locale, { year: 2024 }) -> "© 2024 EverInvests..."
 */
export function t(
  key: string,
  locale: Locale = defaultLocale,
  params?: Record<string, string | number>
): string {
  const dict = translations[locale] || translations[defaultLocale];
  let text = dict[key];

  // Fallback to English if key not found
  if (!text && locale !== defaultLocale) {
    text = translations[defaultLocale][key];
  }

  // Return key if translation not found (helps identify missing translations)
  if (!text) {
    console.warn(`Missing translation: ${key} [${locale}]`);
    return key;
  }

  // Handle interpolation: {year}, {link}, etc.
  if (params) {
    for (const [param, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${param}\\}`, "g"), String(value));
    }
  }

  return text;
}

/**
 * Create a translation function bound to a specific locale
 * Useful in components: const t = useTranslations(locale)
 */
export function useTranslations(locale: Locale) {
  return (key: string, params?: Record<string, string | number>) =>
    t(key, locale, params);
}

/**
 * Get all translations for a locale (for client-side hydration)
 */
export function getTranslations(locale: Locale): Record<string, string> {
  return translations[locale] || translations[defaultLocale];
}

/**
 * Check if a locale is valid
 */
export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

/**
 * Get alternate URLs for hreflang tags
 */
export function getAlternateUrls(
  pathname: string,
  baseUrl: string
): Array<{ locale: Locale; url: string }> {
  // Remove locale prefix if present
  let cleanPath = pathname;
  for (const locale of locales) {
    if (pathname.startsWith(`/${locale}/`)) {
      cleanPath = pathname.slice(locale.length + 1);
      break;
    }
  }

  return locales.map((locale) => ({
    locale,
    url: `${baseUrl}${l(cleanPath, locale)}`,
  }));
}
