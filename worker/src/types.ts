// Shared types for the worker

export type Category = "crypto" | "forex" | "stocks";
export type Bias = "Bullish" | "Bearish" | "Neutral";
export type MacroOverall = "Risk-on" | "Risk-off" | "Mixed" | "Unavailable";

// Asset configuration
export const CRYPTO_ASSETS = ["BTC", "ETH"] as const;
export const FOREX_ASSETS = ["USD/JPY", "EUR/USD", "USD/CAD", "AUD/USD"] as const;
export const STOCK_ASSETS = [
  // Semiconductors
  "NVDA", "AMD", "AVGO", "TSM", "ASML", "INTC", "QCOM", "MU", "AMAT", "LRCX",
  // AI Infrastructure
  "MSFT", "GOOGL", "AMZN", "META", "AAPL",
  // Energy
  "XOM", "CVX", "COP", "SLB", "EOG",
  // Data Centers / Cloud
  "ORCL", "IBM", "NOW", "PLTR", "SNOW"
] as const;

export type CryptoTicker = typeof CRYPTO_ASSETS[number];
export type ForexTicker = typeof FOREX_ASSETS[number];
export type StockTicker = typeof STOCK_ASSETS[number];

// Raw data from APIs
export interface AssetData {
  ticker: string;
  price: number;
  ma20: number;  // 20-day moving average
  volume: number;     // Current volume (24h for crypto, daily for stocks)
  avgVolume: number;  // Average volume (7d for crypto, 20d for stocks)
  secondaryIndicator: number; // funding rate for crypto, RSI for forex/stocks
  timestamp: string;
  // Bollinger Band Width for breakout detection
  bbWidth?: number;  // (Upper - Lower) / Middle, typically 0.01-0.20
}

export interface MacroData {
  dxy: number;
  dxyMa20: number;
  vix: number;
  us10y: number;
  timestamp: string;
  // Expanded free sources
  fearGreed?: number; // 0-100, BTC Fear & Greed Index
  fearGreedLabel?: string; // "Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"
  btcDominance?: number; // percentage, e.g., 52.5
  goldPrice?: number; // XAU/USD
  goldChange?: number; // daily change percentage
  yieldSpread?: number; // 2Y-10Y spread, negative = inverted
  // FRED bridge for tariff/news shock detection
  oilPrice?: number; // WTI crude (DCOILWTICO)
  oilChange?: number; // daily change percentage
  inflationExpectation?: number; // 5Y breakeven (T5YIE)
}

// Calculated signals
export interface AssetSignal {
  ticker: string;
  price: number;
  bias: Bias;
  vsMA20: "above" | "below";
  volumeSignal: "high" | "low" | "normal";  // Volume vs average
  secondaryInd: string;
  reasoning?: string;
  // Indicator signals for confluence analysis
  indicators?: {
    trend: "bullish" | "bearish" | "neutral";      // Price vs MA20
    volume: "confirms" | "diverges" | "neutral";   // Volume confirmation
    strength: "bullish" | "bearish" | "neutral";   // RSI/Funding
  };
  confluence?: string;  // e.g., "2/3 bullish"
  // Relative strength (stocks only - Tier 2)
  relativeStrength?: {
    vsSpy: number;     // RS vs S&P 500 (>1 = outperforming)
    vsSector: number;  // RS vs sector ETF
    sectorEtf: string; // XLK or XLE
  };
}

export interface MacroSignal {
  dxyBias: "strong" | "weak" | "neutral";
  vixLevel: "risk_on" | "risk_off" | "neutral";
  yieldsBias: "rising" | "falling" | "stable";
  overall: MacroOverall;
  // Enhanced macro indicators
  stressLevel?: number; // 0-10, composite stress score
  yieldCurve?: "normal" | "flat" | "inverted"; // Yield curve status
  fearGreedSignal?: "extreme_fear" | "fear" | "neutral" | "greed" | "extreme_greed";
  contrarian?: "bullish" | "bearish" | null; // Override signal from sentiment extremes
  shockDetected?: boolean; // Tariff/policy shock detected
  // Regime classification (Phase 1-5)
  regime?: RegimeClassification;
}

// ============================================================================
// REGIME DETECTION TYPES (5-Phase System)
// ============================================================================

export type RegimeClassificationType =
  | "normal"
  | "event"
  | "stressed"
  | "crisis";

export type EconomicEvent = "FOMC" | "CPI" | "NFP" | "Fed_Speech" | "ECB" | "BOJ";

export interface EventWindowData {
  event: EconomicEvent;
  name: string;
  description: string;
  active: boolean;
  dampening: number;
}

export type FearGreedRegime =
  | "extreme_fear"
  | "fear"
  | "neutral"
  | "greed"
  | "extreme_greed";

export interface FearGreedRegimeData {
  regime: FearGreedRegime;
  value: number;
  contrarian: boolean;
  confidence: number;
}

export type VixRegimeType =
  | "apathy"
  | "complacent"
  | "normal"
  | "stressed"
  | "crisis";

export interface VixRegimeData {
  regime: VixRegimeType;
  vixValue: number;
  action: "aggressive" | "normal" | "cautious" | "defensive";
  signalDampening: number;
}

export interface GdeltHeadline {
  title: string;
  url: string;
}

export interface GdeltRegimeData {
  score: number;
  trend: "rising" | "stable" | "falling";
  topThreats: string[];
  lastUpdated: string;
  regime: "calm" | "elevated" | "high" | "critical";
  signalDampening: number;
  // G5 Enhancement fields
  topHeadlines?: GdeltHeadline[];
  spikeRatio?: number;
}

// ============================================================================
// POLYMARKET PREDICTION MARKET TYPES (Phase 5 Regime Detection)
// ============================================================================

export interface PolymarketTopMarket {
  question: string;
  probability: number;  // 0-100
  category: "crypto" | "fed" | "economy" | "geopolitical";
  volume: number;       // 24h volume in USD
}

export interface PolymarketData {
  cryptoBullish: number;    // 0-100, aggregated crypto bullishness
  fedDovish: number;        // 0-100, probability of Fed dovishness
  recessionOdds: number;    // 0-100, recession probability
  avgVolatility: number;    // 0-100, average uncertainty across markets
  topMarkets: PolymarketTopMarket[];  // Top 3 markets by volume
  marketsCount: number;     // Number of relevant markets found
  fetchedAt: string;
}

export type PolymarketRegimeType =
  | "optimistic"    // Crypto bullish + Fed dovish + low recession
  | "cautious"      // Mixed signals
  | "uncertain"     // High volatility/uncertainty
  | "pessimistic";  // High recession + bearish crypto

export interface PolymarketRegimeData {
  regime: PolymarketRegimeType;
  signalDampening: number;
  cryptoBullish: number;
  fedDovish: number;
  recessionOdds: number;
  avgVolatility: number;
  topMarkets: PolymarketTopMarket[];
  lastUpdated: string;
}

export interface RegimeClassification {
  // Overall regime state
  classification: RegimeClassificationType;
  confidence: number;
  signalDampening: number;
  recommendedAction: "aggressive" | "normal" | "cautious" | "defensive";
  riskLevel: "low" | "moderate" | "high" | "critical";

  // Individual phase data
  phase1_event?: {
    active: boolean;
    events: EventWindowData[];
    dampening: number;
  };
  phase2_fearGreed?: FearGreedRegimeData;
  phase3_vix?: VixRegimeData;
  phase4_gdelt?: GdeltRegimeData;
  phase5_polymarket?: PolymarketRegimeData;

  // Display helpers
  upcomingEvents?: string[];
  summary: string;
}

export interface CategorySignal {
  category: Category;
  date: string;
  timeSlot: string;
  bias: Bias;
  macro: MacroSignal;
  assets: AssetSignal[];
  summary: string;
  levels: Record<string, number>;
  risks: string[];
}
