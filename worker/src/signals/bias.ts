// Bias calculation logic with 3-indicator confluence
// Rule: 2+ bullish signals = Bullish, 2+ bearish = Bearish, else Neutral
//
// ASSET-CLASS SPECIFIC INDICATORS (high IC per class):
//   Crypto:
//     1. Trend: Price vs 7D MA (faster for 24/7 market)
//     2. Volume: Current vs Avg volume (confirms or diverges)
//     3. Strength: Fear & Greed Index (sentiment, not funding rate)
//   Forex:
//     1. Trend: Price vs 20D MA + DXY strength adjustment
//     2. DXY: Strong/weak dollar bias for USD pairs
//     3. Strength: Yield curve (normal=bullish, inverted=bearish)
//   Stocks:
//     1. Trend: Price vs 20D MA
//     2. Volume: Current vs Avg volume
//     3. Strength: RSI (momentum)

import type { AssetData, AssetSignal, Bias, Category, MacroSignal } from "../types";

// Context for asset-class specific calculations
export interface BiasContext {
  macroSignal?: MacroSignal;
  fearGreed?: number;  // 0-100
  dxyBias?: "strong" | "weak" | "neutral";
  yieldCurve?: "normal" | "flat" | "inverted";
}

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

// Indicator 3: Strength indicator - ASSET CLASS SPECIFIC
// Crypto: Fear & Greed (sentiment) - higher IC than funding rate
// Forex: Yield curve (regime) - RSI is meaningless for forex
// Stocks: RSI (momentum) - works for mean-reverting equities
function calculateStrengthSignal(
  indicator: number,
  category: Category,
  context?: BiasContext
): SignalDirection {
  if (category === "crypto") {
    // Use Fear & Greed for crypto strength (IC ~0.25-0.35)
    // F&G < 30 = fear = bullish (buying opportunity)
    // F&G > 70 = greed = bearish (selling opportunity)
    const fearGreed = context?.fearGreed;
    if (fearGreed !== undefined) {
      if (fearGreed < 30) return "bullish";   // Fear = buying opportunity
      if (fearGreed > 70) return "bearish";   // Greed = selling opportunity
      if (fearGreed < 45) return "bullish";   // Slight fear bias
      if (fearGreed > 55) return "bearish";   // Slight greed bias
      return "neutral";
    }
    // Fallback to funding rate if F&G not available
    if (indicator < 0.0001) return "bullish";
    if (indicator > 0.0005) return "bearish";
    return "neutral";
  }

  if (category === "forex") {
    // Use yield curve for forex strength (IC ~0.35-0.50)
    // Normal curve = expansion = risk-on = bullish
    // Inverted curve = recession warning = risk-off = bearish
    const yieldCurve = context?.yieldCurve;
    if (yieldCurve !== undefined) {
      if (yieldCurve === "normal") return "bullish";
      if (yieldCurve === "inverted") return "bearish";
      return "neutral";  // flat
    }
    // Fallback to RSI if yield curve not available (legacy behavior)
    if (indicator < 30) return "bullish";
    if (indicator > 70) return "bearish";
    return "neutral";
  }

  // Stocks: RSI works well for equities (IC ~0.15-0.25)
  if (indicator < 30) return "bullish";
  if (indicator > 70) return "bearish";
  if (indicator < 45) return "bearish";
  if (indicator > 55) return "bullish";
  return "neutral";
}

// DXY strength adjustment for forex pairs
// USD/JPY, USD/CAD: Strong DXY = bullish (USD appreciates)
// EUR/USD, AUD/USD: Strong DXY = bearish (USD appreciates = pair drops)
function getDxyAdjustment(
  ticker: string,
  dxyBias: "strong" | "weak" | "neutral" | undefined
): SignalDirection {
  if (!dxyBias || dxyBias === "neutral") return "neutral";

  // USD is base currency (USD/XXX) - strong DXY = bullish
  const usdBase = ticker.startsWith("USD/");
  // USD is quote currency (XXX/USD) - strong DXY = bearish
  const usdQuote = ticker.endsWith("/USD");

  if (usdBase) {
    return dxyBias === "strong" ? "bullish" : "bearish";
  }
  if (usdQuote) {
    return dxyBias === "strong" ? "bearish" : "bullish";
  }
  return "neutral";
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

// Calculate bias for a single asset with asset-class specific logic
export function calculateAssetBias(
  data: AssetData,
  category: Category,
  context?: BiasContext
): AssetSignal {
  const trendSignal = calculateTrendSignal(data.price, data.ma20);
  const volumeSignal = calculateVolumeSignal(data.volume, data.avgVolume);
  const { direction: volumeDirectionSignal, confirmation: volumeConfirmation } =
    volumeToDirectionalSignal(volumeSignal, trendSignal);

  // Asset-class specific strength calculation
  const strengthSignal = calculateStrengthSignal(data.secondaryIndicator, category, context);

  // For forex: replace volume signal with DXY adjustment (forex has no meaningful volume)
  let secondSignal: SignalDirection;
  let secondConfirmation: VolumeConfirmation | "dxy";

  if (category === "forex") {
    // Forex: Use DXY strength instead of volume (IC ~0.35-0.45)
    const dxySignal = getDxyAdjustment(data.ticker, context?.dxyBias);
    secondSignal = dxySignal;
    secondConfirmation = "dxy";
  } else {
    // Crypto/Stocks: Use volume
    secondSignal = volumeDirectionSignal;
    secondConfirmation = volumeConfirmation;
  }

  const bias = combineBias(trendSignal, secondSignal, strengthSignal);

  // Format secondary indicator for display
  let secondaryDisplay: string;
  if (category === "crypto") {
    // Show F&G if available, otherwise funding rate
    if (context?.fearGreed !== undefined) {
      secondaryDisplay = `F&G:${context.fearGreed}`;
    } else {
      secondaryDisplay = (data.secondaryIndicator * 100).toFixed(4) + "%";
    }
  } else if (category === "forex") {
    // Show yield curve status for forex
    if (context?.yieldCurve) {
      secondaryDisplay = `YC:${context.yieldCurve}`;
    } else {
      secondaryDisplay = data.secondaryIndicator.toFixed(1);
    }
  } else {
    // RSI for stocks
    secondaryDisplay = data.secondaryIndicator.toFixed(1);
  }

  // Reasoning text based on asset class
  let reasoningSecond: string;
  if (category === "forex") {
    reasoningSecond = `DXY: ${context?.dxyBias || "neutral"}`;
  } else {
    reasoningSecond = `Volume: ${secondConfirmation}`;
  }

  return {
    ticker: data.ticker,
    price: data.price,
    bias,
    vsMA20: data.price > data.ma20 ? "above" : "below",
    volumeSignal,
    secondaryInd: secondaryDisplay,
    reasoning: `Trend: ${trendSignal}, ${reasoningSecond}, Strength: ${strengthSignal}`,
    indicators: {
      trend: trendSignal,
      volume: secondConfirmation as VolumeConfirmation,
      strength: strengthSignal,
    },
    confluence: formatConfluence(trendSignal, secondSignal, strengthSignal),
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
