// Macro context calculation
// DXY, VIX, 10Y yields → Risk-on / Risk-off / Mixed

import type { MacroData, MacroSignal, MacroOverall } from "../types";

// DXY (Dollar Index) analysis
// Strong dollar = bearish for risk assets, weak = bullish
function analyzeDXY(price: number, ma20: number): "strong" | "weak" | "neutral" {
  if (ma20 === 0) return "neutral"; // No data

  const diff = (price - ma20) / ma20;
  if (diff > 0.01) return "strong";  // Above MA by 1%
  if (diff < -0.01) return "weak";   // Below MA by 1%
  return "neutral";
}

// VIX analysis
// Low VIX = risk-on, high VIX = risk-off
function analyzeVIX(vix: number): "risk_on" | "risk_off" | "neutral" {
  if (vix === 0) return "neutral"; // No data

  // Note: We're using VIXY ETF as proxy, so thresholds are different
  // VIXY typically trades 10-30 range
  if (vix < 12) return "risk_on";
  if (vix > 20) return "risk_off";
  return "neutral";
}

// 10Y Treasury yield analysis
// Rising yields = bearish for growth, falling = bullish
function analyzeYields(us10y: number): "rising" | "falling" | "stable" {
  if (us10y === 0) return "stable"; // No data

  // We only have current value, so can't determine trend
  // Use absolute levels as proxy
  if (us10y > 4.5) return "rising";   // High yield environment
  if (us10y < 3.5) return "falling";  // Low yield environment
  return "stable";
}

// Combine into overall macro assessment
function calculateOverall(
  dxyBias: "strong" | "weak" | "neutral",
  vixLevel: "risk_on" | "risk_off" | "neutral",
  yieldsBias: "rising" | "falling" | "stable"
): MacroOverall {
  // Risk-on signals: weak dollar, low VIX, falling yields
  // Risk-off signals: strong dollar, high VIX, rising yields

  let riskOnScore = 0;
  let riskOffScore = 0;

  if (dxyBias === "weak") riskOnScore++;
  if (dxyBias === "strong") riskOffScore++;

  if (vixLevel === "risk_on") riskOnScore++;
  if (vixLevel === "risk_off") riskOffScore++;

  if (yieldsBias === "falling") riskOnScore++;
  if (yieldsBias === "rising") riskOffScore++;

  if (riskOnScore >= 2) return "Risk-on";
  if (riskOffScore >= 2) return "Risk-off";
  return "Mixed";
}

export function calculateMacroSignal(data: MacroData): MacroSignal {
  const dxyBias = analyzeDXY(data.dxy, data.dxyMa20);
  const vixLevel = analyzeVIX(data.vix);
  const yieldsBias = analyzeYields(data.us10y);
  const overall = calculateOverall(dxyBias, vixLevel, yieldsBias);

  return {
    dxyBias,
    vixLevel,
    yieldsBias,
    overall,
  };
}

// Format macro signal for display/storage
export function formatMacroForStorage(signal: MacroSignal): {
  dxy_bias: string;
  vix_level: string;
  yields_bias: string;
  overall: string;
} {
  return {
    dxy_bias: signal.dxyBias,
    vix_level: signal.vixLevel,
    yields_bias: signal.yieldsBias,
    overall: signal.overall,
  };
}
