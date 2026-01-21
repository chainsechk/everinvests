import type { WorkflowDefinition } from "../pipeline";
import type { Category } from "../types";
import type { FetchAssetDataOutput } from "../skills/fetchAssetData";
import type { FetchMacroOutput } from "../skills/fetchMacroData";
import type { ComputeBiasOutput } from "../skills/computeBias";
import type { QualityChecksOutput } from "../skills/qualityChecks";
import type { GenerateSummaryOutput } from "../skills/generateSummary";
import type { StoreSignalOutput } from "../skills/storeSignal";
import type { DeliverWebhooksOutput } from "../skills/deliverWebhooks";

export function createCategoryWorkflow(workflowId: string): WorkflowDefinition {
  return {
    id: workflowId,
    steps: [
      {
        id: "macro",
        skill: { id: "fetch_macro_data", version: "3" },
        input: ({ ctx }) => ({ date: ctx.date, timeSlot: ctx.timeSlot }),
      },
      {
        id: "assets",
        skill: { id: "fetch_asset_data", version: "2" },
      },
      {
        id: "bias",
        skill: { id: "compute_bias", version: "3" },
        dependsOn: ["macro", "assets"],
        input: ({ ctx, state }) => {
          const macro = state["macro"] as FetchMacroOutput;
          const assets = state["assets"] as FetchAssetDataOutput;
          return {
            category: ctx.category as Category,
            assetData: assets.assetData,
            macroSignal: macro.macroSignal,
            macroData: macro.macroData, // For F&G, yield curve, DXY in per-asset bias
          };
        },
      },
      {
        id: "quality",
        skill: { id: "quality_checks", version: "2" },
        dependsOn: ["macro", "assets"],
        input: ({ ctx, state }) => {
          const macro = state["macro"] as FetchMacroOutput;
          const assets = state["assets"] as FetchAssetDataOutput;
          return {
            missingTickers: assets.missingTickers,
            macroFallback: macro.macroFallback,
            macroStale: macro.macroStale,
            staleAssets: assets.staleAssets,
            assets: assets.assetData,
            category: ctx.category as Category,
          };
        },
      },
      {
        id: "summary",
        skill: { id: "generate_summary", version: "2" },
        dependsOn: ["macro", "bias"],
        input: ({ ctx, state }) => {
          const macro = state["macro"] as FetchMacroOutput;
          const bias = state["bias"] as ComputeBiasOutput;
          return {
            category: ctx.category as Category,
            bias: bias.categoryBias,
            macro: macro.macroSignal,
            assets: bias.assetSignals,
            levels: bias.levels,
            risks: bias.risks,
          };
        },
      },
      {
        id: "store",
        skill: { id: "store_signal", version: "2" },
        dependsOn: ["macro", "assets", "bias", "quality", "summary"],
        input: ({ ctx, state }) => {
          const macro = state["macro"] as FetchMacroOutput;
          const assets = state["assets"] as FetchAssetDataOutput;
          const bias = state["bias"] as ComputeBiasOutput;
          const quality = state["quality"] as QualityChecksOutput;
          const summary = state["summary"] as GenerateSummaryOutput;

          return {
            category: ctx.category as Category,
            date: ctx.date,
            timeSlot: ctx.timeSlot,
            bias: bias.categoryBias,
            macroId: macro.macroId,
            rawData: assets.assetData,
            assetSignals: bias.assetSignals,
            summary: summary.summary,
            levels: bias.levels,
            risks: bias.risks,
            qualityFlags: quality.qualityFlags,
          };
        },
      },
      {
        id: "notify",
        skill: { id: "notify_telegram", version: "4" },
        dependsOn: ["macro", "bias", "summary", "store"],
        input: ({ ctx, state }) => {
          const macro = state["macro"] as FetchMacroOutput;
          const bias = state["bias"] as ComputeBiasOutput;
          const summary = state["summary"] as GenerateSummaryOutput;
          const store = state["store"] as StoreSignalOutput;

          return {
            category: ctx.category as Category,
            bias: bias.categoryBias,
            summary: summary.summary,
            assets: bias.assetSignals,
            macro: macro.macroSignal,
            date: ctx.date,
            timeSlot: ctx.timeSlot,
            delta: store.delta,
          };
        },
      },
      {
        id: "webhooks",
        skill: { id: "deliver_webhooks", version: "1" },
        dependsOn: ["macro", "bias", "summary", "store"],
        input: ({ ctx, state }) => {
          const macro = state["macro"] as FetchMacroOutput;
          const bias = state["bias"] as ComputeBiasOutput;
          const summary = state["summary"] as GenerateSummaryOutput;
          const store = state["store"] as StoreSignalOutput;

          return {
            signalId: store.signalId,
            category: ctx.category as Category,
            date: ctx.date,
            timeSlot: ctx.timeSlot,
            bias: bias.categoryBias,
            summary: summary.summary,
            macro: macro.macroSignal,
            assets: bias.assetSignals,
          };
        },
      },
    ],
  };
}
