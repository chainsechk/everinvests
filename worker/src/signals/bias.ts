// Bias calculation logic with 3-indicator confluence
// Rule: 2+ bullish signals = Bullish, 2+ bearish = Bearish, else Neutral
// Indicators:
//   1. Trend: Price vs MA20 (position in trend)
//   2. Volume: Current vs Avg volume (confirms or diverges from trend)
//   3. Strength: RSI (forex/stocks) or Funding Rate (crypto)
// Enhanced: Contrarian override from macro signals (F&G extremes)

import type { AssetData, AssetSignal, Bias, Category, MacroSignal } from "../types";

type SignalDirection = "bullish" | "bearish" | "neutral";
type VolumeSignal = "high" | "low" | "normal";
type VolumeConfirmation = "confirms" | "diverges" | "neutral";

// Indicator 1: Price vs 20-day MA (Trend Position)
function calculateTrendSignal(price: number, ma20: number): SignalDirection {
  const diff = (price - ma20) / ma20;
  // Above MA by more than 1% = bullish, below by more than 1% = bearish
  if (diff > 0.01) return "bullish";
  if (diff < -0.01) return "bearish";
  return "neutral";
}

// Indicator 2: Volume vs Average Volume
// High volume confirms the trend, low volume suggests weak conviction
function calculateVolumeSignal(volume: number, avgVolume: number): VolumeSignal {
  if (avgVolume <= 0) return "normal";
  const ratio = volume / avgVolume;
  // Volume > 1.2x average = high (strong conviction)
  // Volume < 0.8x average = low (weak conviction)
  if (ratio > 1.2) return "high";
  if (ratio < 0.8) return "low";
  return "normal";
}

// Convert volume to directional signal based on trend
// High volume confirms trend direction, low volume suggests possible reversal
function volumeToDirectionalSignal(
  volumeSignal: VolumeSignal,
  trendSignal: SignalDirection
): { direction: SignalDirection; confirmation: VolumeConfirmation } {
  if (volumeSignal === "high") {
    // High volume confirms the trend
    return {
      direction: trendSignal === "neutral" ? "neutral" : trendSignal,
      confirmation: "confirms",
    };
  }
  if (volumeSignal === "low") {
    // Low volume suggests weak move, possible reversal
    return {
      direction: "neutral",
      confirmation: "diverges",
    };
  }
  return { direction: "neutral", confirmation: "neutral" };
}

// Indicator 3: Strength indicator (RSI or Funding Rate)
function calculateStrengthSignal(
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
    // < 30 = oversold (bullish reversal potential)
    // > 70 = overbought (bearish reversal potential)
    // 30-50 with trend = supporting bearish
    // 50-70 with trend = supporting bullish
    if (indicator < 30) return "bullish";
    if (indicator > 70) return "bearish";
    // RSI in middle range: slight bias based on which side of 50
    if (indicator < 45) return "bearish";
    if (indicator > 55) return "bullish";
    return "neutral";
  }
}

// Combine 3 signals into final bias
function combineBias(
  trendSignal: SignalDirection,
  volumeDirectionSignal: SignalDirection,
  strengthSignal: SignalDirection
): Bias {
  const signals = [trendSignal, volumeDirectionSignal, strengthSignal];
  const bullishCount = signals.filter(s => s === "bullish").length;
  const bearishCount = signals.filter(s => s === "bearish").length;

  // 2+ of 3 signals agree = that direction, else Neutral
  if (bullishCount >= 2) return "Bullish";
  if (bearishCount >= 2) return "Bearish";
  return "Neutral";
}

// Calculate confluence string for display
function formatConfluence(
  trendSignal: SignalDirection,
  volumeDirectionSignal: SignalDirection,
  strengthSignal: SignalDirection
): string {
  const signals = [trendSignal, volumeDirectionSignal, strengthSignal];
  const bullishCount = signals.filter(s => s === "bullish").length;
  const bearishCount = signals.filter(s => s === "bearish").length;

  if (bullishCount > bearishCount) {
    return `${bullishCount}/3 bullish`;
  } else if (bearishCount > bullishCount) {
    return `${bearishCount}/3 bearish`;
  }
  return "mixed";
}

// Calculate bias for a single asset
export function calculateAssetBias(data: AssetData, category: Category): AssetSignal {
  const trendSignal = calculateTrendSignal(data.price, data.ma20);
  const volumeSignal = calculateVolumeSignal(data.volume, data.avgVolume);
  const { direction: volumeDirectionSignal, confirmation: volumeConfirmation } =
    volumeToDirectionalSignal(volumeSignal, trendSignal);
  const strengthSignal = calculateStrengthSignal(data.secondaryIndicator, category);
  const bias = combineBias(trendSignal, volumeDirectionSignal, strengthSignal);

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
    volumeSignal,
    secondaryInd: secondaryDisplay,
    reasoning: `Trend: ${trendSignal}, Volume: ${volumeConfirmation}, Strength: ${strengthSignal}`,
    indicators: {
      trend: trendSignal,
      volume: volumeConfirmation,
      strength: strengthSignal,
    },
    confluence: formatConfluence(trendSignal, volumeDirectionSignal, strengthSignal),
  };
}

// Calculate overall category bias from asset signals
// Optional macro signal for contrarian override at sentiment extremes
export function calculateCategoryBias(
  assetSignals: AssetSignal[],
  macroSignal?: MacroSignal
): Bias {
  if (assetSignals.length === 0) return "Neutral";

  const bullishCount = assetSignals.filter(s => s.bias === "Bullish").length;
  const bearishCount = assetSignals.filter(s => s.bias === "Bearish").length;
  const total = assetSignals.length;

  // Base bias from majority vote
  let baseBias: Bias = "Neutral";
  if (bullishCount > total / 2) baseBias = "Bullish";
  else if (bearishCount > total / 2) baseBias = "Bearish";

  // Apply contrarian override from F&G extremes
  // Only override when technical and sentiment conflict (creates edge)
  if (macroSignal?.contrarian) {
    const contrarianBias = macroSignal.contrarian === "bullish" ? "Bullish" : "Bearish";

    // Override if technical is neutral or opposite to contrarian
    if (baseBias === "Neutral") {
      console.log(`[Bias] Contrarian override: Neutral → ${contrarianBias} (F&G extreme)`);
      return contrarianBias;
    }

    // If base is opposite to contrarian, move to Neutral (conflicting signals)
    if (baseBias !== contrarianBias) {
      console.log(`[Bias] Contrarian conflict: ${baseBias} + ${contrarianBias} → Neutral`);
      return "Neutral";
    }
  }

  return baseBias;
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

  // Check for volume divergence (weak conviction)
  const lowVolumeCount = assetSignals.filter(s => s.volumeSignal === "low").length;
  if (lowVolumeCount > assetSignals.length / 2) {
    risks.push("Low volume across assets - weak conviction");
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
