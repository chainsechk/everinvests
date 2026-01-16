// Telegram Bot API for signal notifications

import type { AssetSignal, Bias, Category, MacroSignal } from "../types";

const TELEGRAM_API = "https://api.telegram.org/bot";
const DEFAULT_SITE_URL = "https://everinvests.com";

interface TelegramResponse {
  ok: boolean;
  result?: any;
  description?: string;
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
  siteUrl?: string
): string {
  const biasEmoji = bias === "Bullish" ? "🟢" : bias === "Bearish" ? "🔴" : "🟡";
  const macroEmoji = macro.overall === "Risk-on" ? "📈" : macro.overall === "Risk-off" ? "📉" : "➡️";

  const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1);

  let message = `${biasEmoji} <b>${categoryTitle} Signal - ${bias}</b>\n`;
  message += `📅 ${date} ${timeSlot} UTC\n\n`;

  message += `${summary}\n\n`;

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

  const baseUrl = (siteUrl || DEFAULT_SITE_URL).replace(/\/$/, "");
  const analysisUrl = new URL(`/${category}`, baseUrl).href;
  message += `\n🔗 <a href="${analysisUrl}">View Full Analysis</a>`;

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
  timeSlot: string
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
    siteUrl
  );

  return sendTelegramMessage(botToken, chatId, message);
}
