// Macro context calculation
// DXY, VIX, 10Y yields → Risk-on / Risk-off / Mixed
// Enhanced with: Fear & Greed contrarian, Yield curve, Shock detection
// + 5-Phase Regime Detection (Event, F&G, VIX, GDELT, Polymarket)

import type { MacroData, MacroSignal, MacroOverall, PolymarketTopMarket } from "../types";
import { classifyRegime } from "./regime";

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

// Fear & Greed analysis (contrarian at extremes)
type FearGreedSignal = "extreme_fear" | "fear" | "neutral" | "greed" | "extreme_greed";

function analyzeFearGreed(value: number | undefined): {
  signal: FearGreedSignal;
  contrarian: "bullish" | "bearish" | null;
} {
  if (value === undefined) {
    return { signal: "neutral", contrarian: null };
  }

  // Extreme readings are contrarian signals
  if (value <= 20) {
    return { signal: "extreme_fear", contrarian: "bullish" }; // Buy when others are fearful
  }
  if (value <= 35) {
    return { signal: "fear", contrarian: null };
  }
  if (value >= 80) {
    return { signal: "extreme_greed", contrarian: "bearish" }; // Sell when others are greedy
  }
  if (value >= 65) {
    return { signal: "greed", contrarian: null };
  }
  return { signal: "neutral", contrarian: null };
}

// Yield curve analysis from 2Y-10Y spread
type YieldCurveState = "normal" | "flat" | "inverted";

function analyzeYieldCurve(spread: number | undefined): YieldCurveState {
  if (spread === undefined) return "normal";

  // Spread < -0.2 = clearly inverted (recession warning)
  // Spread -0.2 to 0.3 = flat (transition zone)
  // Spread > 0.3 = normal (healthy expansion)
  if (spread < -0.2) return "inverted";
  if (spread < 0.3) return "flat";
  return "normal";
}

// Shock detection from oil and inflation movements
function detectShock(
  oilChange: number | undefined,
  inflationExpectation: number | undefined
): boolean {
  // Shock = sudden large moves suggesting policy/tariff impact
  // Oil spike > 5% in a day OR inflation expectation > 3% (elevated)
  const oilShock = oilChange !== undefined && Math.abs(oilChange) > 5;
  const inflationShock = inflationExpectation !== undefined && inflationExpectation > 3;

  return oilShock || inflationShock;
}

// Calculate composite stress level (0-10)
function calculateStressLevel(
  vixLevel: "risk_on" | "risk_off" | "neutral",
  yieldCurve: YieldCurveState,
  fearGreedSignal: FearGreedSignal,
  shockDetected: boolean
): number {
  let stress = 5; // baseline

  // VIX contribution (+/- 2)
  if (vixLevel === "risk_off") stress += 2;
  if (vixLevel === "risk_on") stress -= 2;

  // Yield curve contribution (+/- 1.5)
  if (yieldCurve === "inverted") stress += 1.5;
  if (yieldCurve === "normal") stress -= 0.5;

  // Fear & Greed contribution (+/- 1)
  if (fearGreedSignal === "extreme_fear") stress += 1;
  if (fearGreedSignal === "extreme_greed") stress -= 0.5;

  // Shock contribution (+1.5)
  if (shockDetected) stress += 1.5;

  // Clamp to 0-10
  return Math.max(0, Math.min(10, Math.round(stress * 10) / 10));
}

// Combine into overall macro assessment
function calculateOverall(
  dxyBias: "strong" | "weak" | "neutral",
  vixLevel: "risk_on" | "risk_off" | "neutral",
  yieldsBias: "rising" | "falling" | "stable",
  yieldCurve: YieldCurveState
): MacroOverall {
  // Risk-on signals: weak dollar, low VIX, falling yields, normal curve
  // Risk-off signals: strong dollar, high VIX, rising yields, inverted curve

  let riskOnScore = 0;
  let riskOffScore = 0;

  if (dxyBias === "weak") riskOnScore++;
  if (dxyBias === "strong") riskOffScore++;

  if (vixLevel === "risk_on") riskOnScore++;
  if (vixLevel === "risk_off") riskOffScore++;

  if (yieldsBias === "falling") riskOnScore++;
  if (yieldsBias === "rising") riskOffScore++;

  // Yield curve is a strong signal
  if (yieldCurve === "inverted") riskOffScore += 0.5;
  if (yieldCurve === "normal") riskOnScore += 0.5;

  if (riskOnScore >= 2) return "Risk-on";
  if (riskOffScore >= 2) return "Risk-off";
  return "Mixed";
}

// GDELT result from database (Phase 4, G5 enhanced)
interface GdeltInput {
  score: number;
  trend: "rising" | "stable" | "falling";
  topThreats: string[];
  // G5 Enhancement fields
  topHeadlines?: Array<{ title: string; url: string }>;
  spikeRatio?: number;
}

// Polymarket result from database (Phase 5)
interface PolymarketInput {
  cryptoBullish: number;    // 0-100
  fedDovish: number;        // 0-100
  recessionOdds: number;    // 0-100
  avgVolatility: number;    // 0-100
  topMarkets: PolymarketTopMarket[];
  fetchedAt: string;
}

export function calculateMacroSignal(
  data: MacroData,
  date?: string,
  timeSlot?: string,
  gdeltData?: GdeltInput,
  polymarketData?: PolymarketInput
): MacroSignal {
  const dxyBias = analyzeDXY(data.dxy, data.dxyMa20);
  const vixLevel = analyzeVIX(data.vix);
  const yieldsBias = analyzeYields(data.us10y);

  // New enhanced indicators
  const { signal: fearGreedSignal, contrarian } = analyzeFearGreed(data.fearGreed);
  const yieldCurve = analyzeYieldCurve(data.yieldSpread);
  const shockDetected = detectShock(data.oilChange, data.inflationExpectation);

  const overall = calculateOverall(dxyBias, vixLevel, yieldsBias, yieldCurve);
  const stressLevel = calculateStressLevel(vixLevel, yieldCurve, fearGreedSignal, shockDetected);

  // Phase 1-5: Regime Classification (G5: now with headlines and spike ratio)
  const regime = date && timeSlot
    ? classifyRegime({
        date,
        timeSlot,
        fearGreed: data.fearGreed,
        vix: data.vix,
        stressLevel,
        // Phase 4: GDELT geopolitical data
        gdeltScore: gdeltData?.score,
        gdeltTrend: gdeltData?.trend,
        gdeltTopThreats: gdeltData?.topThreats,
        // G5 Enhancement fields
        gdeltTopHeadlines: gdeltData?.topHeadlines,
        gdeltSpikeRatio: gdeltData?.spikeRatio,
        // Phase 5: Polymarket prediction market data
        polymarket: polymarketData,
      })
    : undefined;

  return {
    dxyBias,
    vixLevel,
    yieldsBias,
    overall,
    // Enhanced fields
    stressLevel,
    yieldCurve,
    fearGreedSignal,
    contrarian,
    shockDetected,
    // Regime classification
    regime,
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
