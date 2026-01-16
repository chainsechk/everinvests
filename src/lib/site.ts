export const SITE_URL = (import.meta.env.SITE ?? "").replace(/\/$/, "");

export function absoluteUrl(pathname: string): string {
  if (!SITE_URL) return pathname;
  return new URL(pathname, SITE_URL).href;
}
