import { computeQualityFlags, type QualityFlags } from "../quality/checks";
import type { SkillSpec } from "./types";

export interface QualityChecksInput {
  missingTickers: string[];
  macroFallback: boolean;
}

export interface QualityChecksOutput {
  qualityFlags: QualityFlags;
}

export const qualityChecksSkill: SkillSpec<QualityChecksInput, QualityChecksOutput> = {
  id: "quality_checks",
  version: "1",
  async run({ input }) {
    return {
      qualityFlags: computeQualityFlags({
        missingTickers: input.missingTickers,
        macroFallback: input.macroFallback,
      }),
    };
  },
};
