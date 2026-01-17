import { fetchMacroData } from "../data";
import { calculateMacroSignal } from "../signals";
import type { MacroData, MacroSignal } from "../types";
import { saveMacroSignal } from "../storage/d1";
import type { SharedState, SkillSpec } from "./types";

export interface FetchMacroInput {
  date: string;
  timeSlot: string;
}

export interface FetchMacroOutput {
  macroSignal: MacroSignal;
  macroId: number | null;
  macroFallback: boolean;
  macroStale: boolean;
}

const SHARED_KEY = "macro:v2";

function isValidMacroData(data: MacroData): boolean {
  return (
    Number.isFinite(data.dxy) &&
    data.dxy > 0 &&
    Number.isFinite(data.dxyMa20) &&
    data.dxyMa20 > 0 &&
    Number.isFinite(data.vix) &&
    data.vix > 0 &&
    Number.isFinite(data.us10y) &&
    data.us10y > 0
  );
}

function readShared(shared: SharedState): FetchMacroOutput | undefined {
  return shared[SHARED_KEY] as FetchMacroOutput | undefined;
}

function writeShared(shared: SharedState, value: FetchMacroOutput): void {
  shared[SHARED_KEY] = value;
}

export const fetchMacroDataSkill: SkillSpec<FetchMacroInput, FetchMacroOutput> = {
  id: "fetch_macro_data",
  version: "2",
  async run({ env, input, shared }) {
    const cached = readShared(shared);
    if (cached) return cached;

    let macroData: MacroData | null = null;
    let macroSignal: MacroSignal | null = null;
    let macroFallback = false;
    let macroStale = false;
    let fallbackReason: string | undefined;

    if (!env.ALPHAVANTAGE_API_KEY) {
      macroFallback = true;
      fallbackReason = "ALPHAVANTAGE_API_KEY not configured";
    } else if (!env.TWELVEDATA_API_KEY) {
      macroFallback = true;
      fallbackReason = "TWELVEDATA_API_KEY not configured";
    } else {
      const result = await fetchMacroData({
        twelveData: env.TWELVEDATA_API_KEY,
        alphaVantage: env.ALPHAVANTAGE_API_KEY,
      });
      macroData = result.data;
      macroStale = result.isStale;

      if (!isValidMacroData(macroData)) {
        macroFallback = true;
        fallbackReason = "Macro fetch returned invalid data";
      } else {
        macroSignal = calculateMacroSignal(macroData);
      }
    }

    const signalForDownstream: MacroSignal = macroSignal ?? {
      dxyBias: "neutral",
      vixLevel: "neutral",
      yieldsBias: "stable",
      overall: "Unavailable",
    };

    const macroId = await saveMacroSignal({
      db: env.DB,
      date: input.date,
      timeSlot: input.timeSlot,
      signal: signalForDownstream,
      rawData: macroData ?? { timestamp: new Date().toISOString() },
      fallbackReason,
    });

    const result: FetchMacroOutput = {
      macroSignal: signalForDownstream,
      macroId: macroId || null,
      macroFallback,
      macroStale,
    };

    writeShared(shared, result);
    return result;
  },
};
