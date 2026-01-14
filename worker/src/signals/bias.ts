// Bias calculation logic
// Rule: 2 bullish signals = Bullish, 2 bearish = Bearish, else Neutral

import type { AssetData, AssetSignal, Bias, Category } from "../types";

type SignalDirection = "bullish" | "bearish" | "neutral";

// Price vs 20-day MA
function calculateMASignal(price: number, ma20: number): SignalDirection {
  const diff = (price - ma20) / ma20;
  // Above MA by more than 1% = bullish, below by more than 1% = bearish
  if (diff > 0.01) return "bullish";
  if (diff < -0.01) return "bearish";
  return "neutral";
}

// Secondary indicator signal
function calculateSecondarySignal(
  indicator: number,
  category: Category
): SignalDirection {
  if (category === "crypto") {
    // Funding rate: low = bullish (not overcrowded), high = bearish
    // Typical range: -0.01% to 0.1%
    if (indicator < 0.0001) return "bullish";  // < 0.01%
    if (indicator > 0.0005) return "bearish";  // > 0.05%
    return "neutral";
  } else {
    // RSI for forex/stocks
    // < 30 = oversold (bullish), > 70 = overbought (bearish)
    if (indicator < 30) return "bullish";
    if (indicator > 70) return "bearish";
    return "neutral";
  }
}

// Combine signals into final bias
function combineBias(maSignal: SignalDirection, secondarySignal: SignalDirection): Bias {
  const bullishCount = [maSignal, secondarySignal].filter(s => s === "bullish").length;
  const bearishCount = [maSignal, secondarySignal].filter(s => s === "bearish").length;

  if (bullishCount >= 2) return "Bullish";
  if (bearishCount >= 2) return "Bearish";
  return "Neutral";
}

// Calculate bias for a single asset
export function calculateAssetBias(data: AssetData, category: Category): AssetSignal {
  const maSignal = calculateMASignal(data.price, data.ma20);
  const secondarySignal = calculateSecondarySignal(data.secondaryIndicator, category);
  const bias = combineBias(maSignal, secondarySignal);

  // Format secondary indicator for display
  let secondaryDisplay: string;
  if (category === "crypto") {
    // Funding rate as percentage
    secondaryDisplay = (data.secondaryIndicator * 100).toFixed(4) + "%";
  } else {
    // RSI as number
    secondaryDisplay = data.secondaryIndicator.toFixed(1);
  }

  return {
    ticker: data.ticker,
    price: data.price,
    bias,
    vsMA20: data.price > data.ma20 ? "above" : "below",
    secondaryInd: secondaryDisplay,
    reasoning: `MA20: ${maSignal}, Secondary: ${secondarySignal}`,
  };
}

// Calculate overall category bias from asset signals
export function calculateCategoryBias(assetSignals: AssetSignal[]): Bias {
  if (assetSignals.length === 0) return "Neutral";

  const bullishCount = assetSignals.filter(s => s.bias === "Bullish").length;
  const bearishCount = assetSignals.filter(s => s.bias === "Bearish").length;
  const total = assetSignals.length;

  // Majority vote
  if (bullishCount > total / 2) return "Bullish";
  if (bearishCount > total / 2) return "Bearish";
  return "Neutral";
}

// Extract key price levels for the category
export function extractLevels(
  assetSignals: AssetSignal[],
  category: Category
): Record<string, number> {
  const levels: Record<string, number> = {};

  for (const signal of assetSignals) {
    const key = `${signal.ticker.toLowerCase().replace("/", "_")}_price`;
    levels[key] = Math.round(signal.price * 100) / 100;
  }

  return levels;
}

// Identify risk factors
export function identifyRisks(
  assetSignals: AssetSignal[],
  category: Category
): string[] {
  const risks: string[] = [];

  // Check for extreme readings
  const extremeBullish = assetSignals.filter(s => s.bias === "Bullish").length;
  const extremeBearish = assetSignals.filter(s => s.bias === "Bearish").length;

  if (extremeBullish === assetSignals.length) {
    risks.push("All assets bullish - potential reversal risk");
  }
  if (extremeBearish === assetSignals.length) {
    risks.push("All assets bearish - potential bounce risk");
  }

  // Category-specific risks
  if (category === "crypto") {
    const highFunding = assetSignals.some(s => parseFloat(s.secondaryInd) > 0.05);
    if (highFunding) {
      risks.push("Elevated funding rates - squeeze risk");
    }
  } else if (category === "stocks") {
    const highRSI = assetSignals.filter(s => parseFloat(s.secondaryInd) > 65).length;
    if (highRSI > assetSignals.length / 2) {
      risks.push("Multiple overbought readings - pullback risk");
    }
  }

  if (risks.length === 0) {
    risks.push("Standard market conditions");
  }

  return risks;
}
