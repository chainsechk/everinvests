// Shared types for the worker

export type Category = "crypto" | "forex" | "stocks";
export type Bias = "Bullish" | "Bearish" | "Neutral";
export type MacroOverall = "Risk-on" | "Risk-off" | "Mixed";

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
  ma20: number;
  secondaryIndicator: number; // funding rate for crypto, RSI for forex/stocks
  timestamp: string;
}

export interface MacroData {
  dxy: number;
  dxyMa20: number;
  vix: number;
  us10y: number;
  timestamp: string;
}

// Calculated signals
export interface AssetSignal {
  ticker: string;
  price: number;
  bias: Bias;
  vsMA20: "above" | "below";
  secondaryInd: string;
  reasoning?: string;
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
