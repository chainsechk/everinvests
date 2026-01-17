import type { AssetData, Category } from "../types";

export interface QualityFlags {
  missing_assets?: string[];
  macro_fallback?: boolean;
  macro_stale?: boolean;
  stale_assets?: string[];
  outlier_values?: OutlierInfo[];
}

export interface OutlierInfo {
  ticker: string;
  field: "price" | "rsi" | "funding";
  value: number;
  reason: string;
}

// Thresholds for outlier detection
export const OUTLIER_THRESHOLDS = {
  // Price deviation from MA (percentage)
  PRICE_MA_DEVIATION_MAX: 0.5, // 50% above/below MA is suspicious

  // RSI extremes
  RSI_MIN: 5, // Very oversold, possibly stale
  RSI_MAX: 95, // Very overbought, possibly stale

  // Crypto funding rate (absolute value)
  FUNDING_RATE_MAX: 0.01, // 1% funding is extreme
};

// Detect outlier values in asset data
export function detectOutliers(
  assets: AssetData[],
  category: Category
): OutlierInfo[] {
  const outliers: OutlierInfo[] = [];

  for (const asset of assets) {
    // Check price vs MA deviation
    if (asset.ma20 > 0) {
      const deviation = Math.abs(asset.price - asset.ma20) / asset.ma20;
      if (deviation > OUTLIER_THRESHOLDS.PRICE_MA_DEVIATION_MAX) {
        outliers.push({
          ticker: asset.ticker,
          field: "price",
          value: asset.price,
          reason: `${(deviation * 100).toFixed(1)}% from MA20`,
        });
      }
    }

    // Check secondary indicator (RSI for forex/stocks, funding for crypto)
    if (category === "crypto") {
      // Funding rate check
      const fundingAbs = Math.abs(asset.secondaryIndicator);
      if (fundingAbs > OUTLIER_THRESHOLDS.FUNDING_RATE_MAX) {
        outliers.push({
          ticker: asset.ticker,
          field: "funding",
          value: asset.secondaryIndicator,
          reason: `Extreme funding rate: ${(asset.secondaryIndicator * 100).toFixed(4)}%`,
        });
      }
    } else {
      // RSI check for forex/stocks
      if (asset.secondaryIndicator < OUTLIER_THRESHOLDS.RSI_MIN) {
        outliers.push({
          ticker: asset.ticker,
          field: "rsi",
          value: asset.secondaryIndicator,
          reason: `Extremely oversold RSI: ${asset.secondaryIndicator.toFixed(1)}`,
        });
      } else if (asset.secondaryIndicator > OUTLIER_THRESHOLDS.RSI_MAX) {
        outliers.push({
          ticker: asset.ticker,
          field: "rsi",
          value: asset.secondaryIndicator,
          reason: `Extremely overbought RSI: ${asset.secondaryIndicator.toFixed(1)}`,
        });
      }
    }
  }

  return outliers;
}

export interface QualityCheckInput {
  missingTickers: string[];
  macroFallback: boolean;
  macroStale?: boolean;
  staleAssets?: string[];
  assets?: AssetData[];
  category?: Category;
}

export function computeQualityFlags(args: QualityCheckInput): QualityFlags {
  const flags: QualityFlags = {};

  if (args.missingTickers.length > 0) {
    flags.missing_assets = args.missingTickers;
  }

  if (args.macroFallback) {
    flags.macro_fallback = true;
  }

  if (args.macroStale) {
    flags.macro_stale = true;
  }

  if (args.staleAssets && args.staleAssets.length > 0) {
    flags.stale_assets = args.staleAssets;
  }

  // Detect outliers if asset data is provided
  if (args.assets && args.category) {
    const outliers = detectOutliers(args.assets, args.category);
    if (outliers.length > 0) {
      flags.outlier_values = outliers;
    }
  }

  return flags;
}

// Check if any quality flags are set (useful for UI)
export function hasQualityIssues(flags: QualityFlags): boolean {
  return !!(
    flags.missing_assets?.length ||
    flags.macro_fallback ||
    flags.macro_stale ||
    flags.stale_assets?.length ||
    flags.outlier_values?.length
  );
}
