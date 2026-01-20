// Telegram Bot API for signal notifications

import type { AssetSignal, Bias, Category, MacroSignal } from "../types";
import type { SignalDelta } from "../signals";
import { getCTAConfig, getCTAMode, type CTAMode } from "../config";

const TELEGRAM_API = "https://api.telegram.org/bot";
const DEFAULT_SITE_URL = "https://everinvests.com";

interface TelegramResponse {
  ok: boolean;
  result?: any;
  description?: string;
}

// Format delta section for message
function formatDeltaSection(delta: SignalDelta | null): string {
  if (!delta || !delta.previousBias) {
    return "";
  }

  const parts: string[] = [];

  // Bias change
  if (delta.biasChanged) {
    const changeEmoji = delta.currentBias === "Bullish" ? "⬆️" : delta.currentBias === "Bearish" ? "⬇️" : "➡️";
    parts.push(`${changeEmoji} Bias: ${delta.previousBias} → ${delta.currentBias}`);
  }

  // Biggest movers
  if (delta.priceMovers.biggest_gainer) {
    const { ticker, delta: pct } = delta.priceMovers.biggest_gainer;
    parts.push(`📈 ${ticker} +${pct.toFixed(1)}%`);
  }
  if (delta.priceMovers.biggest_loser) {
    const { ticker, delta: pct } = delta.priceMovers.biggest_loser;
    parts.push(`📉 ${ticker} ${pct.toFixed(1)}%`);
  }

  // Changed assets summary
  if (delta.changedAssets > 0) {
    parts.push(`🔄 ${delta.changedAssets}/${delta.totalAssets} changed bias`);
  }

  return parts.length > 0 ? `<b>Changes:</b>\n${parts.join("\n")}\n\n` : "";
}

// Format signal message for Telegram
export function formatSignalMessage(
  category: Category,
  bias: Bias,
  summary: string,
  assets: AssetSignal[],
  macro: MacroSignal,
  date: string,
  timeSlot: string,
  siteUrl?: string,
  delta?: SignalDelta | null,
  ctaMode?: CTAMode
): string {
  const biasEmoji = bias === "Bullish" ? "🟢" : bias === "Bearish" ? "🔴" : "🟡";
  const macroEmoji = macro.overall === "Risk-on" ? "📈" : macro.overall === "Risk-off" ? "📉" : "➡️";

  const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1);

  let message = `${biasEmoji} <b>${categoryTitle} Bias: ${bias}</b>\n`;
  message += `📅 ${date} ${timeSlot} UTC\n\n`;

  message += `${summary}\n\n`;

  // Delta section (if available)
  message += formatDeltaSection(delta ?? null);

  message += `${macroEmoji} <b>Macro:</b> ${macro.overall}\n`;
  message += `• DXY: ${macro.dxyBias}\n`;
  message += `• VIX: ${macro.vixLevel.replace("_", " ")}\n\n`;

  message += `<b>Assets:</b>\n`;
  for (const asset of assets.slice(0, 10)) { // Limit to 10 for readability
    const assetEmoji = asset.bias === "Bullish" ? "🟢" : asset.bias === "Bearish" ? "🔴" : "🟡";
    message += `${assetEmoji} ${asset.ticker}: $${asset.price.toLocaleString()} (${asset.vsMA20} MA)\n`;
  }

  if (assets.length > 10) {
    message += `... and ${assets.length - 10} more\n`;
  }

  // Build URL with UTM parameters
  const baseUrl = (siteUrl || DEFAULT_SITE_URL).replace(/\/$/, "");
  const analysisUrl = new URL(`/${category}/${date}/${timeSlot}`, baseUrl);
  analysisUrl.searchParams.set("utm_source", "telegram");
  analysisUrl.searchParams.set("utm_medium", "notification");
  analysisUrl.searchParams.set("utm_campaign", `${category}_signal`);
  message += `\n🔗 <a href="${analysisUrl.href}">View Full Analysis</a>`;

  // Add VIP CTA if configured
  const cta = getCTAConfig(ctaMode || 'waitlist').telegram;
  if (cta) {
    message += cta;
  }

  return message;
}

// Send message to Telegram channel
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  message: string
): Promise<boolean> {
  const url = `${TELEGRAM_API}${botToken}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    const data: TelegramResponse = await response.json();

    if (!data.ok) {
      console.error("Telegram send failed:", data.description);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Telegram request failed:", error);
    return false;
  }
}

// Main entry point for sending signal notification
export async function notifySignal(
  botToken: string | undefined,
  chatId: string | undefined,
  siteUrl: string | undefined,
  category: Category,
  bias: Bias,
  summary: string,
  assets: AssetSignal[],
  macro: MacroSignal,
  date: string,
  timeSlot: string,
  delta?: SignalDelta | null,
  ctaMode?: CTAMode
): Promise<boolean> {
  if (!botToken || !chatId) {
    console.log("Telegram credentials not configured, skipping notification");
    return false;
  }

  const message = formatSignalMessage(
    category,
    bias,
    summary,
    assets,
    macro,
    date,
    timeSlot,
    siteUrl,
    delta,
    ctaMode
  );

  return sendTelegramMessage(botToken, chatId, message);
}
