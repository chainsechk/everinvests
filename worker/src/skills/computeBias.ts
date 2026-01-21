import { calculateAssetBias, calculateCategoryBias, extractLevels, identifyRisks } from "../signals";
import type { AssetData, AssetSignal, Bias, Category, MacroSignal } from "../types";
import type { SkillSpec } from "./types";

export interface ComputeBiasInput {
  category: Category;
  assetData: AssetData[];
  macroSignal?: MacroSignal; // For contrarian override
}

export interface ComputeBiasOutput {
  assetSignals: AssetSignal[];
  categoryBias: Bias;
  levels: Record<string, number>;
  risks: string[];
}

export const computeBiasSkill: SkillSpec<ComputeBiasInput, ComputeBiasOutput> = {
  id: "compute_bias",
  version: "2", // Bumped for macro signal support
  async run({ input }) {
    const assetSignals = input.assetData.map((data) =>
      calculateAssetBias(data, input.category)
    );

    // Pass macro signal for contrarian override at F&G extremes
    const categoryBias = calculateCategoryBias(assetSignals, input.macroSignal);
    const levels = extractLevels(assetSignals, input.category);
    const risks = identifyRisks(assetSignals, input.category);

    return { assetSignals, categoryBias, levels, risks };
  },
};
