import { notifySignal } from "../notify";
import type { AssetSignal, Bias, Category, MacroSignal } from "../types";
import type { SignalDelta } from "../signals";
import type { SkillSpec } from "./types";
import { getCTAMode } from "../config";

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
}

export const notifyTelegramSkill: SkillSpec<NotifyTelegramInput, NotifyTelegramOutput> = {
  id: "notify_telegram",
  version: "3",
  async run({ env, input }) {
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

    return { notified };
  },
};
