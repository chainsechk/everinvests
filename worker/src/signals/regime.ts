/**
 * Regime Classification System
 *
 * 5-Phase regime detection for signal quality improvement:
 * - Phase 1: Economic Calendar Events
 * - Phase 2: Fear & Greed Extreme Regime
 * - Phase 3: VIX Regime Thresholds
 * - Phase 4: GDELT Geopolitical Score
 * - Phase 5: Polymarket Prediction Markets
 */

import {
  getEventDampening,
  getActiveEventWindows,
  formatUpcomingEvents,
} from "../data/economic-calendar";

import type {
  RegimeClassificationType,
  EventWindowData,
  FearGreedRegimeData,
  VixRegimeData,
  GdeltRegimeData,
  PolymarketRegimeData,
  PolymarketRegimeType,
  PolymarketTopMarket,
  RegimeClassification,
} from "../types";

// ============================================================================
// PHASE 1: ECONOMIC CALENDAR EVENTS
// ============================================================================

export function classifyRegimePhase1(
  date: string,
  timeSlot: string
): RegimeClassification["phase1_event"] {
  const activeWindows = getActiveEventWindows(date, timeSlot);
  const dampening = getEventDampening(date, timeSlot);

  if (activeWindows.length === 0) {
    return {
      active: false,
      events: [],
      dampening: 1.0,
    };
  }

  const events: EventWindowData[] = activeWindows.map((aw) => ({
    event: aw.event,
    name: aw.config.name,
    description: aw.config.description,
    active: true,
    dampening: aw.dampening,
  }));

  return {
    active: true,
    events,
    dampening,
  };
}

// ============================================================================
// PHASE 2: FEAR & GREED EXTREME REGIME (EXISTING LOGIC WRAPPED)
// ============================================================================

export function classifyRegimePhase2(
  fearGreed: number | undefined
): FearGreedRegimeData | undefined {
  if (fearGreed === undefined) return undefined;

  if (fearGreed <= 20) {
    return {
      regime: "extreme_fear",
      value: fearGreed,
      contrarian: true,
      confidence: 0.85,
    };
  }
  if (fearGreed <= 35) {
    return {
      regime: "fear",
      value: fearGreed,
      contrarian: false,
      confidence: 0.7,
    };
  }
  if (fearGreed >= 80) {
    return {
      regime: "extreme_greed",
      value: fearGreed,
      contrarian: true,
      confidence: 0.85,
    };
  }
  if (fearGreed >= 65) {
    return {
      regime: "greed",
      value: fearGreed,
      contrarian: false,
      confidence: 0.7,
    };
  }
  return {
    regime: "neutral",
    value: fearGreed,
    contrarian: false,
    confidence: 0.5,
  };
}

// ============================================================================
// PHASE 3: VIX REGIME THRESHOLDS
// ============================================================================

export function classifyRegimePhase3(vix: number): VixRegimeData {
  if (vix > 30) {
    return {
      regime: "crisis",
      vixValue: vix,
      action: "defensive",
      signalDampening: 0.3,
    };
  }
  if (vix > 20) {
    return {
      regime: "stressed",
      vixValue: vix,
      action: "cautious",
      signalDampening: 0.7,
    };
  }
  if (vix < 10) {
    return {
      regime: "apathy",
      vixValue: vix,
      action: "cautious", // Dangerously complacent
      signalDampening: 0.85,
    };
  }
  if (vix < 12) {
    return {
      regime: "complacent",
      vixValue: vix,
      action: "normal",
      signalDampening: 1.0,
    };
  }
  return {
    regime: "normal",
    vixValue: vix,
    action: "normal",
    signalDampening: 1.0,
  };
}

// ============================================================================
// PHASE 4: GDELT GEOPOLITICAL SCORE
// ============================================================================

export function classifyRegimePhase4(
  gdeltScore: number | undefined,
  gdeltTrend?: "rising" | "stable" | "falling",
  topThreats?: string[],
  topHeadlines?: Array<{ title: string; url: string }>,
  spikeRatio?: number
): GdeltRegimeData | undefined {
  if (gdeltScore === undefined) return undefined;

  let regime: "calm" | "elevated" | "high" | "critical";
  let signalDampening: number;

  if (gdeltScore >= 70) {
    regime = "critical";
    signalDampening = 0.4;
  } else if (gdeltScore >= 50) {
    regime = "high";
    signalDampening = 0.7;
  } else if (gdeltScore >= 30) {
    regime = "elevated";
    signalDampening = 0.9;
  } else {
    regime = "calm";
    signalDampening = 1.0;
  }

  return {
    score: gdeltScore,
    trend: gdeltTrend ?? "stable",
    topThreats: topThreats ?? [],
    lastUpdated: new Date().toISOString(),
    regime,
    signalDampening,
    // G5 Enhancement fields
    topHeadlines: topHeadlines ?? [],
    spikeRatio: spikeRatio ?? 1.0,
  };
}

// ============================================================================
// PHASE 5: POLYMARKET PREDICTION MARKETS
// ============================================================================

export interface ClassifyPolymarketInput {
  cryptoBullish: number;    // 0-100
  fedDovish: number;        // 0-100
  recessionOdds: number;    // 0-100
  avgVolatility: number;    // 0-100
  topMarkets: PolymarketTopMarket[];
  fetchedAt: string;
}

/**
 * Classify prediction market sentiment into regime impact
 *
 * Regimes:
 * - optimistic: High crypto bullish + Fed dovish + low recession (1.0x)
 * - cautious: Mixed signals (0.85x)
 * - uncertain: High volatility/disagreement (0.7x)
 * - pessimistic: High recession odds + bearish crypto (0.5x)
 */
export function classifyRegimePhase5(
  input: ClassifyPolymarketInput | undefined
): PolymarketRegimeData | undefined {
  if (!input) return undefined;

  const { cryptoBullish, fedDovish, recessionOdds, avgVolatility, topMarkets, fetchedAt } = input;

  let regime: PolymarketRegimeType;
  let signalDampening: number;

  // High volatility (uncertainty) always dampens signals
  if (avgVolatility >= 70) {
    regime = "uncertain";
    signalDampening = 0.7;
  }
  // Pessimistic: high recession + bearish crypto
  else if (recessionOdds >= 60 && cryptoBullish <= 40) {
    regime = "pessimistic";
    signalDampening = 0.5;
  }
  // Optimistic: bullish crypto + dovish Fed + low recession
  else if (cryptoBullish >= 65 && fedDovish >= 55 && recessionOdds <= 35) {
    regime = "optimistic";
    signalDampening = 1.0;
  }
  // Cautious: mixed or moderate signals
  else if (recessionOdds >= 45 || cryptoBullish <= 45) {
    regime = "cautious";
    signalDampening = 0.85;
  }
  // Default to optimistic if mostly positive
  else {
    regime = "optimistic";
    signalDampening = 1.0;
  }

  return {
    regime,
    signalDampening,
    cryptoBullish,
    fedDovish,
    recessionOdds,
    avgVolatility,
    topMarkets,
    lastUpdated: fetchedAt,
  };
}

// ============================================================================
// COMBINED REGIME CLASSIFICATION
// ============================================================================

export interface ClassifyRegimeInput {
  date: string;
  timeSlot: string;
  fearGreed?: number;
  vix?: number;
  stressLevel?: number;
  // Phase 4: GDELT geopolitical data
  gdeltScore?: number;
  gdeltTrend?: "rising" | "stable" | "falling";
  gdeltTopThreats?: string[];
  // G5 Enhancement fields
  gdeltTopHeadlines?: Array<{ title: string; url: string }>;
  gdeltSpikeRatio?: number;
  // Phase 5: Polymarket prediction market data
  polymarket?: ClassifyPolymarketInput;
}

export function classifyRegime(input: ClassifyRegimeInput): RegimeClassification {
  const { date, timeSlot, fearGreed, vix, stressLevel, gdeltScore, gdeltTrend, gdeltTopThreats, gdeltTopHeadlines, gdeltSpikeRatio, polymarket } = input;

  // Phase 1: Economic Events
  const phase1 = classifyRegimePhase1(date, timeSlot);

  // Phase 2: Fear & Greed
  const phase2 = classifyRegimePhase2(fearGreed);

  // Phase 3: VIX Thresholds
  const phase3 = vix !== undefined ? classifyRegimePhase3(vix) : undefined;

  // Phase 4: GDELT Geopolitical (G5: now with headlines and spike ratio)
  const phase4 = classifyRegimePhase4(gdeltScore, gdeltTrend, gdeltTopThreats, gdeltTopHeadlines, gdeltSpikeRatio);

  // Phase 5: Polymarket Prediction Markets
  const phase5 = classifyRegimePhase5(polymarket);

  // Calculate combined dampening (use most restrictive)
  let signalDampening = 1.0;
  if (phase1?.active) {
    signalDampening = Math.min(signalDampening, phase1.dampening);
  }
  if (phase3) {
    signalDampening = Math.min(signalDampening, phase3.signalDampening);
  }
  if (phase4) {
    signalDampening = Math.min(signalDampening, phase4.signalDampening);
  }
  if (phase5) {
    signalDampening = Math.min(signalDampening, phase5.signalDampening);
  }

  // Determine overall classification
  let classification: RegimeClassificationType = "normal";
  let confidence = 0.5;
  let recommendedAction: RegimeClassification["recommendedAction"] = "normal";
  let riskLevel: RegimeClassification["riskLevel"] = "moderate";

  // Priority: Crisis > Stressed > Event > Normal
  // Phase 4 critical geopolitical = crisis
  if (phase4?.regime === "critical") {
    classification = "crisis";
    confidence = 0.85;
    recommendedAction = "defensive";
    riskLevel = "critical";
  } else if (phase3?.regime === "crisis") {
    classification = "crisis";
    confidence = 0.9;
    recommendedAction = "defensive";
    riskLevel = "critical";
  } else if (phase4?.regime === "high") {
    classification = "stressed";
    confidence = 0.8;
    recommendedAction = "cautious";
    riskLevel = "high";
  } else if (phase3?.regime === "stressed") {
    classification = "stressed";
    confidence = 0.8;
    recommendedAction = "cautious";
    riskLevel = "high";
  } else if (phase1?.active) {
    classification = "event";
    confidence = 0.85;
    recommendedAction = "cautious";
    riskLevel = "high";
  } else if (phase2?.regime === "extreme_fear" || phase2?.regime === "extreme_greed") {
    classification = "stressed";
    confidence = 0.75;
    recommendedAction = "cautious";
    riskLevel = "high";
  }

  // Use stress level if available to refine
  if (stressLevel !== undefined) {
    if (stressLevel >= 7) {
      riskLevel = "critical";
      if (classification === "normal") {
        classification = "stressed";
        recommendedAction = "cautious";
      }
    } else if (stressLevel >= 5 && riskLevel === "moderate") {
      // Keep at moderate, don't downgrade
    } else if (stressLevel < 3 && classification === "normal") {
      riskLevel = "low";
    }
  }

  // Get upcoming events for display
  const upcomingEvents = formatUpcomingEvents(date, 7);

  // Generate summary
  const summary = generateRegimeSummary(classification, phase1, phase2, phase3, phase4, phase5);

  return {
    classification,
    confidence,
    signalDampening,
    recommendedAction,
    riskLevel,
    phase1_event: phase1,
    phase2_fearGreed: phase2,
    phase3_vix: phase3,
    phase4_gdelt: phase4,
    phase5_polymarket: phase5,
    upcomingEvents,
    summary,
  };
}

function generateRegimeSummary(
  classification: RegimeClassificationType,
  phase1: RegimeClassification["phase1_event"],
  phase2: FearGreedRegimeData | undefined,
  phase3: VixRegimeData | undefined,
  phase4: GdeltRegimeData | undefined,
  phase5: PolymarketRegimeData | undefined
): string {
  const parts: string[] = [];

  if (classification === "crisis") {
    if (phase4?.regime === "critical") {
      parts.push(`Geopolitical crisis (score ${phase4.score})`);
    } else {
      parts.push("Market in crisis mode (VIX >30)");
    }
  } else if (classification === "event") {
    const eventNames = phase1?.events.map((e) => e.name).join(", ") || "economic event";
    parts.push(`Active event window: ${eventNames}`);
  } else if (classification === "stressed") {
    if (phase4?.regime === "high") {
      parts.push(`Elevated geopolitical risk (score ${phase4.score})`);
    }
    if (phase3?.regime === "stressed") {
      parts.push("Elevated volatility regime");
    }
    if (phase2?.regime === "extreme_fear") {
      parts.push("Extreme fear - contrarian bullish");
    } else if (phase2?.regime === "extreme_greed") {
      parts.push("Extreme greed - contrarian bearish");
    }
  } else {
    parts.push("Normal market conditions");
  }

  if (phase3?.regime === "apathy") {
    parts.push("Warning: VIX unusually low (complacency)");
  }

  // Add rising geopolitical tension warning
  if (phase4?.trend === "rising" && phase4.regime !== "calm") {
    parts.push(`Geopolitical tension rising`);
  }

  // Add prediction market sentiment
  if (phase5) {
    if (phase5.regime === "pessimistic") {
      parts.push(`Markets pricing recession (${phase5.recessionOdds}% odds)`);
    } else if (phase5.regime === "uncertain") {
      parts.push("Prediction markets show high uncertainty");
    } else if (phase5.regime === "optimistic" && phase5.cryptoBullish >= 70) {
      parts.push(`Crypto sentiment bullish (${phase5.cryptoBullish}%)`);
    }
  }

  return parts.join(". ");
}
