import { generateSummary, type LLMRunResult } from "../llm";
import { ensurePromptVersion, saveLLMRun } from "../storage/d1";
import type { AssetSignal, Bias, Category, MacroSignal } from "../types";
import type { SkillSpec } from "./types";

export interface GenerateSummaryInput {
  category: Category;
  bias: Bias;
  macro: MacroSignal;
  assets: AssetSignal[];
  levels: Record<string, number>;
  risks: string[];
  signalId?: number; // Optional: for linking LLM run to signal
}

export interface GenerateSummaryOutput {
  summary: string;
  llmRun: LLMRunResult;
}

export const generateSummarySkill: SkillSpec<GenerateSummaryInput, GenerateSummaryOutput> = {
  id: "generate_summary",
  version: "2", // Bumped version for provenance tracking
  async run({ env, input }) {
    const { signalId, ...summaryInput } = input;

    // Generate summary with provenance tracking
    const llmRun = await generateSummary(summaryInput, env.AI, env.OPENROUTER_API_KEY);

    // Save prompt version to DB (if not exists)
    let promptVersionId: number | null = null;
    try {
      promptVersionId = await ensurePromptVersion({
        db: env.DB,
        name: llmRun.promptName,
        version: llmRun.promptVersion,
        template: `${llmRun.promptName}@${llmRun.promptVersion}`, // Template stored as reference
        createdAt: new Date().toISOString(),
      });
    } catch (e) {
      console.error("Failed to ensure prompt version:", e);
    }

    // Save LLM run to DB for provenance
    try {
      await saveLLMRun({
        db: env.DB,
        signalId: signalId ?? null,
        promptVersionId,
        model: llmRun.model,
        tokensIn: llmRun.tokensIn,
        tokensOut: llmRun.tokensOut,
        latencyMs: llmRun.latencyMs,
        status: llmRun.status,
        errorMsg: llmRun.errorMsg,
        fallbackReason: llmRun.fallbackReason,
      });
    } catch (e) {
      console.error("Failed to save LLM run:", e);
    }

    return {
      summary: llmRun.summary,
      llmRun,
    };
  },
};
