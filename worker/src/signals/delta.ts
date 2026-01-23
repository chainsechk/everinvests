// Delta computation - compares current signal vs previous
import type { AssetSignal, Bias, Category } from "../types";

export interface AssetDelta {
  ticker: string;
  priceDelta: number; // percentage change
  biasChanged: boolean;
  previousBias: Bias | null;
  currentBias: Bias;
}

export interface SignalDelta {
  biasChanged: boolean;
  previousBias: Bias | null;
  currentBias: Bias;
  assetDeltas: AssetDelta[];
  priceMovers: {
    biggest_gainer: { ticker: string; delta: number } | null;
    biggest_loser: { ticker: string; delta: number } | null;
  };
  changedAssets: number;
  totalAssets: number;
}

interface PreviousSignalData {
  bias: Bias;
  assets: Array<{
    ticker: string;
    price: number;
    bias: Bias;
  }>;
}

export function computeDelta(
  currentBias: Bias,
  currentAssets: AssetSignal[],
  previous: PreviousSignalData | null
): SignalDelta {
  // No previous signal - first run
  if (!previous) {
    return {
      biasChanged: false,
      previousBias: null,
      currentBias,
      assetDeltas: currentAssets.map((a) => ({
        ticker: a.ticker,
        priceDelta: 0,
        biasChanged: false,
        previousBias: null,
        currentBias: a.bias,
      })),
      priceMovers: {
        biggest_gainer: null,
        biggest_loser: null,
      },
      changedAssets: 0,
      totalAssets: currentAssets.length,
    };
  }

  // Build lookup for previous assets
  const prevAssetMap = new Map<string, { price: number; bias: Bias }>();
  for (const asset of previous.assets) {
    prevAssetMap.set(asset.ticker, { price: asset.price, bias: asset.bias });
  }

  // Compute per-asset deltas
  const assetDeltas: AssetDelta[] = [];
  let changedAssets = 0;

  for (const current of currentAssets) {
    const prev = prevAssetMap.get(current.ticker);
    let priceDelta = 0;
    let biasChanged = false;
    let previousBias: Bias | null = null;

    if (prev) {
      priceDelta = prev.price > 0 ? ((current.price - prev.price) / prev.price) * 100 : 0;
      biasChanged = prev.bias !== current.bias;
      previousBias = prev.bias;
      if (biasChanged) changedAssets++;
    }

    assetDeltas.push({
      ticker: current.ticker,
      priceDelta: Math.round(priceDelta * 100) / 100, // 2 decimal places
      biasChanged,
      previousBias,
      currentBias: current.bias,
    });
  }

  // Find biggest movers
  const sortedByDelta = [...assetDeltas].sort((a, b) => b.priceDelta - a.priceDelta);
  const biggest_gainer =
    sortedByDelta.length > 0 && sortedByDelta[0].priceDelta > 0
      ? { ticker: sortedByDelta[0].ticker, delta: sortedByDelta[0].priceDelta }
      : null;
  const biggest_loser =
    sortedByDelta.length > 0 && sortedByDelta[sortedByDelta.length - 1].priceDelta < 0
      ? {
          ticker: sortedByDelta[sortedByDelta.length - 1].ticker,
          delta: sortedByDelta[sortedByDelta.length - 1].priceDelta,
        }
      : null;

  return {
    biasChanged: previous.bias !== currentBias,
    previousBias: previous.bias,
    currentBias,
    assetDeltas,
    priceMovers: {
      biggest_gainer,
      biggest_loser,
    },
    changedAssets,
    totalAssets: currentAssets.length,
  };
}

/**
 * Format a delta into a human-readable summary string
 */
export function formatDeltaSummary(delta: SignalDelta): string {
  // First signal - no previous data
  if (delta.previousBias === null) {
    return "No significant changes";
  }

  const parts: string[] = [];

  // Bias change
  if (delta.biasChanged) {
    parts.push(`${delta.previousBias} → ${delta.currentBias}`);
  }

  // Biggest movers
  const { biggest_gainer, biggest_loser } = delta.priceMovers;
  if (biggest_gainer) {
    parts.push(`${biggest_gainer.ticker} +${biggest_gainer.delta.toFixed(1)}%`);
  }
  if (biggest_loser) {
    parts.push(`${biggest_loser.ticker} ${biggest_loser.delta.toFixed(1)}%`);
  }

  // If nothing significant happened
  if (parts.length === 0) {
    return "No significant changes";
  }

  return parts.join(". ");
}

