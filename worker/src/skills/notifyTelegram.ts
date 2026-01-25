import { notifySignal } from "../notify";
import type { AssetSignal, Bias, Category, MacroSignal } from "../types";
import { calculateImportanceScore, type SignalDelta } from "../signals";
import type { SkillSpec } from "./types";
import { getCTAMode } from "../config";

// Minimum importance score to trigger a notification
// Score breakdown:
// - Bias changed: +50 (always sends)
// - >3 assets changed bias: +20
// - Big mover >5%: +30 each
// - First signal: +100 (always sends)
// Threshold of 30 means: big mover OR bias change OR first signal
const IMPORTANCE_THRESHOLD = 30;

export interface NotifyTelegramInput {
  category: Category;
  bias: Bias;
  summary: string;
  assets: AssetSignal[];
  macro: MacroSignal;
  date: string;
  timeSlot: string;
  delta?: SignalDelta | null;
}

export interface NotifyTelegramOutput {
  notified: boolean;
  skipped?: boolean;
  importanceScore?: number;
  reason?: string;
}

export const notifyTelegramSkill: SkillSpec<NotifyTelegramInput, NotifyTelegramOutput> = {
  id: "notify_telegram",
  version: "5", // v5: Added importance filtering to reduce notification noise
  async run({ env, input }) {
    // Calculate importance score based on delta
    const importanceScore = calculateImportanceScore(input.delta);

    // Skip notification if signal is not important enough
    if (importanceScore < IMPORTANCE_THRESHOLD) {
      console.log(
        `[notify_telegram] Skipping ${input.category} signal: importance ${importanceScore} < threshold ${IMPORTANCE_THRESHOLD}`
      );
      return {
        notified: false,
        skipped: true,
        importanceScore,
        reason: `Low importance (${importanceScore}/${IMPORTANCE_THRESHOLD}): no bias change, no big movers`,
      };
    }

    console.log(
      `[notify_telegram] Sending ${input.category} signal: importance ${importanceScore} >= threshold ${IMPORTANCE_THRESHOLD}`
    );

    const ctaMode = getCTAMode(env);
    const notified = await notifySignal(
      env.TELEGRAM_BOT_TOKEN,
      env.TELEGRAM_CHAT_ID,
      env.SITE_URL,
      input.category,
      input.bias,
      input.summary,
      input.assets,
      input.macro,
      input.date,
      input.timeSlot,
      input.delta,
      ctaMode
    );

    return {
      notified,
      skipped: false,
      importanceScore,
    };
  },
};
