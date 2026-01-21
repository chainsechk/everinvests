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
}

export interface MacroSignal {
  dxyBias: "strong" | "weak" | "neutral";
  vixLevel: "risk_on" | "risk_off" | "neutral";
  yieldsBias: "rising" | "falling" | "stable";
  overall: MacroOverall;
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
