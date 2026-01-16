import { generateSummary } from "../llm";
import type { AssetSignal, Bias, Category, MacroSignal } from "../types";
import type { SkillSpec } from "./types";

export interface GenerateSummaryInput {
  category: Category;
  bias: Bias;
  macro: MacroSignal;
  assets: AssetSignal[];
  levels: Record<string, number>;
  risks: string[];
}

export interface GenerateSummaryOutput {
  summary: string;
}

export const generateSummarySkill: SkillSpec<GenerateSummaryInput, GenerateSummaryOutput> = {
  id: "generate_summary",
  version: "1",
  async run({ env, input }) {
    const summary = await generateSummary(input, env.AI, env.OPENROUTER_API_KEY);
    return { summary };
  },
};
