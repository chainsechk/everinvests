import { calculateAssetBias, calculateCategoryBias, extractLevels, identifyRisks, type BiasContext } from "../signals";
import type { AssetData, AssetSignal, Bias, Category, MacroSignal, MacroData } from "../types";
import type { SkillSpec } from "./types";

export interface ComputeBiasInput {
  category: Category;
  assetData: AssetData[];
  macroSignal?: MacroSignal;
  macroData?: MacroData; // Raw macro data for F&G, etc.
}

export interface ComputeBiasOutput {
  assetSignals: AssetSignal[];
  categoryBias: Bias;
  levels: Record<string, number>;
  risks: string[];
}

export const computeBiasSkill: SkillSpec<ComputeBiasInput, ComputeBiasOutput> = {
  id: "compute_bias",
  version: "3", // Bumped for asset-class specific indicators
  async run({ input }) {
    // Build context for asset-class specific calculations
    const context: BiasContext = {
      macroSignal: input.macroSignal,
      fearGreed: input.macroData?.fearGreed,
      dxyBias: input.macroSignal?.dxyBias,
      yieldCurve: input.macroSignal?.yieldCurve,
    };

    // Calculate per-asset bias with context
    const assetSignals = input.assetData.map((data) =>
      calculateAssetBias(data, input.category, context)
    );

    // Pass macro signal for contrarian override at F&G extremes
    const categoryBias = calculateCategoryBias(assetSignals, input.macroSignal);
    const levels = extractLevels(assetSignals, input.category);
    const risks = identifyRisks(assetSignals, input.category);

    return { assetSignals, categoryBias, levels, risks };
  },
};
