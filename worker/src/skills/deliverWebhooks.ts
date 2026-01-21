import { deliverWebhooks } from "../webhooks/deliver";
import type { AssetSignal, Bias, Category, MacroSignal } from "../types";
import type { SkillSpec } from "./types";

export interface DeliverWebhooksInput {
  signalId: number;
  category: Category;
  date: string;
  timeSlot: string;
  bias: Bias;
  summary: string;
  macro: MacroSignal;
  assets: AssetSignal[];
}

export interface DeliverWebhooksOutput {
  delivered: boolean;
}

export const deliverWebhooksSkill: SkillSpec<DeliverWebhooksInput, DeliverWebhooksOutput> = {
  id: "deliver_webhooks",
  version: "1",
  async run({ env, input }) {
    try {
      await deliverWebhooks(
        env,
        input.signalId,
        input.category,
        input.date,
        input.timeSlot,
        input.bias,
        input.summary,
        input.macro,
        input.assets
      );
      return { delivered: true };
    } catch (error) {
      console.error("[Webhook] Delivery failed:", error);
      return { delivered: false };
    }
  },
};
