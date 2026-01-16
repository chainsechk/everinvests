import { calculateAssetBias, calculateCategoryBias, extractLevels, identifyRisks } from "../signals";
import type { AssetData, AssetSignal, Bias, Category } from "../types";
import type { SkillSpec } from "./types";

export interface ComputeBiasInput {
  category: Category;
  assetData: AssetData[];
}

export interface ComputeBiasOutput {
  assetSignals: AssetSignal[];
  categoryBias: Bias;
  levels: Record<string, number>;
  risks: string[];
}

export const computeBiasSkill: SkillSpec<ComputeBiasInput, ComputeBiasOutput> = {
  id: "compute_bias",
  version: "1",
  async run({ input }) {
    const assetSignals = input.assetData.map((data) =>
      calculateAssetBias(data, input.category)
    );

    const categoryBias = calculateCategoryBias(assetSignals);
    const levels = extractLevels(assetSignals, input.category);
    const risks = identifyRisks(assetSignals, input.category);

    return { assetSignals, categoryBias, levels, risks };
  },
};
