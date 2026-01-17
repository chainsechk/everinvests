import { computeQualityFlags, hasQualityIssues, type QualityFlags } from "../quality/checks";
import type { AssetData, Category } from "../types";
import type { SkillSpec } from "./types";

export interface QualityChecksInput {
  missingTickers: string[];
  macroFallback: boolean;
  macroStale?: boolean;
  staleAssets?: string[];
  assets?: AssetData[];
  category?: Category;
}

export interface QualityChecksOutput {
  qualityFlags: QualityFlags;
  hasIssues: boolean;
}

export const qualityChecksSkill: SkillSpec<QualityChecksInput, QualityChecksOutput> = {
  id: "quality_checks",
  version: "2",
  async run({ input }) {
    const qualityFlags = computeQualityFlags({
      missingTickers: input.missingTickers,
      macroFallback: input.macroFallback,
      macroStale: input.macroStale,
      staleAssets: input.staleAssets,
      assets: input.assets,
      category: input.category,
    });

    return {
      qualityFlags,
      hasIssues: hasQualityIssues(qualityFlags),
    };
  },
};
