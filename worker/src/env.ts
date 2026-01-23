export interface Env {
  DB: D1Database;
  AI: Ai;
  SITE_URL?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  OPENROUTER_API_KEY?: string;
  TWELVEDATA_API_KEY?: string;
  ALPHAVANTAGE_API_KEY?: string;
  FRED_API_KEY?: string;
  VIP_CTA_MODE?: string;
  // Security
  WORKER_AUTH_TOKEN?: string; // Bearer token for admin routes
}
