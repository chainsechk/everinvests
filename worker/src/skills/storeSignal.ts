import { saveAssetSignals, saveSignal, getPreviousSignalForDelta } from "../storage/d1";
import { computeDelta, type SignalDelta } from "../signals";
import type { AssetData, AssetSignal, Bias, Category } from "../types";
import type { QualityFlags } from "../quality/checks";
import type { SkillSpec } from "./types";

export interface StoreSignalInput {
  category: Category;
  date: string;
  timeSlot: string;
  bias: Bias;
  macroId: number | null;
  rawData: AssetData[];
  assetSignals: AssetSignal[];
  summary: string;
  levels: Record<string, number>;
  risks: string[];
  qualityFlags: QualityFlags;
}

export interface StoreSignalOutput {
  signalId: number;
  delta: SignalDelta | null;
}

export const storeSignalSkill: SkillSpec<StoreSignalInput, StoreSignalOutput> = {
  id: "store_signal",
  version: "2",
  async run({ env, input }) {
    // Fetch previous signal for delta computation
    const previousData = await getPreviousSignalForDelta({
      db: env.DB,
      category: input.category,
      date: input.date,
      timeSlot: input.timeSlot,
    });

    // Compute delta vs previous signal
    const delta = computeDelta(input.bias, input.assetSignals, previousData);

    const output = {
      summary: input.summary,
      levels: input.levels,
      risks: input.risks,
      quality_flags: input.qualityFlags,
      delta,
    };

    const signalId = await saveSignal({
      db: env.DB,
      category: input.category,
      date: input.date,
      timeSlot: input.timeSlot,
      bias: input.bias,
      macroId: input.macroId,
      rawData: input.rawData,
      output,
    });

    await saveAssetSignals({
      db: env.DB,
      signalId,
      assets: input.assetSignals,
    });

    return { signalId, delta };
  },
};
