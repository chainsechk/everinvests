import { describe, it, expect } from "vitest";
import {
  detectOutliers,
  computeQualityFlags,
  hasQualityIssues,
  OUTLIER_THRESHOLDS,
} from "../../worker/src/quality/checks";
import type { AssetData } from "../../worker/src/types";

describe("detectOutliers", () => {
  it("should detect price deviation from MA20", () => {
    const assets: AssetData[] = [
      {
        ticker: "NVDA",
        price: 200, // 100% above MA20
        ma20: 100,
        secondaryIndicator: 50,
        timestamp: new Date().toISOString(),
      },
    ];

    const outliers = detectOutliers(assets, "stocks");

    expect(outliers).toHaveLength(1);
    expect(outliers[0].ticker).toBe("NVDA");
    expect(outliers[0].field).toBe("price");
    expect(outliers[0].reason).toContain("from MA20");
  });

  it("should not flag normal price deviation", () => {
    const assets: AssetData[] = [
      {
        ticker: "AAPL",
        price: 110, // 10% above MA20 - within threshold
        ma20: 100,
        secondaryIndicator: 50,
        timestamp: new Date().toISOString(),
      },
    ];

    const outliers = detectOutliers(assets, "stocks");

    expect(outliers).toHaveLength(0);
  });

  it("should detect extreme RSI for stocks", () => {
    const assets: AssetData[] = [
      {
        ticker: "XOM",
        price: 100,
        ma20: 100,
        secondaryIndicator: 3, // RSI < 5 is extreme
        timestamp: new Date().toISOString(),
      },
    ];

    const outliers = detectOutliers(assets, "stocks");

    expect(outliers).toHaveLength(1);
    expect(outliers[0].ticker).toBe("XOM");
    expect(outliers[0].field).toBe("rsi");
    expect(outliers[0].reason).toContain("oversold");
  });

  it("should detect extreme high RSI for forex", () => {
    const assets: AssetData[] = [
      {
        ticker: "EUR/USD",
        price: 1.1,
        ma20: 1.1,
        secondaryIndicator: 97, // RSI > 95 is extreme
        timestamp: new Date().toISOString(),
      },
    ];

    const outliers = detectOutliers(assets, "forex");

    expect(outliers).toHaveLength(1);
    expect(outliers[0].field).toBe("rsi");
    expect(outliers[0].reason).toContain("overbought");
  });

  it("should detect extreme funding rate for crypto", () => {
    const assets: AssetData[] = [
      {
        ticker: "BTC",
        price: 50000,
        ma20: 50000,
        secondaryIndicator: 0.02, // 2% funding is extreme
        timestamp: new Date().toISOString(),
      },
    ];

    const outliers = detectOutliers(assets, "crypto");

    expect(outliers).toHaveLength(1);
    expect(outliers[0].ticker).toBe("BTC");
    expect(outliers[0].field).toBe("funding");
    expect(outliers[0].reason).toContain("funding rate");
  });

  it("should not flag normal funding rate", () => {
    const assets: AssetData[] = [
      {
        ticker: "ETH",
        price: 3000,
        ma20: 3000,
        secondaryIndicator: 0.005, // 0.5% funding is normal
        timestamp: new Date().toISOString(),
      },
    ];

    const outliers = detectOutliers(assets, "crypto");

    expect(outliers).toHaveLength(0);
  });

  it("should detect multiple issues for same asset", () => {
    const assets: AssetData[] = [
      {
        ticker: "MEME",
        price: 200, // 100% above MA20
        ma20: 100,
        secondaryIndicator: 98, // Extreme RSI
        timestamp: new Date().toISOString(),
      },
    ];

    const outliers = detectOutliers(assets, "stocks");

    expect(outliers).toHaveLength(2);
    expect(outliers.some(o => o.field === "price")).toBe(true);
    expect(outliers.some(o => o.field === "rsi")).toBe(true);
  });
});

describe("computeQualityFlags", () => {
  it("should return empty flags when no issues", () => {
    const flags = computeQualityFlags({
      missingTickers: [],
      macroFallback: false,
    });

    expect(flags).toEqual({});
  });

  it("should set missing_assets when tickers are missing", () => {
    const flags = computeQualityFlags({
      missingTickers: ["BTC", "ETH"],
      macroFallback: false,
    });

    expect(flags.missing_assets).toEqual(["BTC", "ETH"]);
  });

  it("should set macro_fallback when macro fails", () => {
    const flags = computeQualityFlags({
      missingTickers: [],
      macroFallback: true,
    });

    expect(flags.macro_fallback).toBe(true);
  });

  it("should set macro_stale when macro data is stale", () => {
    const flags = computeQualityFlags({
      missingTickers: [],
      macroFallback: false,
      macroStale: true,
    });

    expect(flags.macro_stale).toBe(true);
  });

  it("should set stale_assets when assets have stale data", () => {
    const flags = computeQualityFlags({
      missingTickers: [],
      macroFallback: false,
      staleAssets: ["NVDA", "MSFT"],
    });

    expect(flags.stale_assets).toEqual(["NVDA", "MSFT"]);
  });

  it("should detect outliers when assets and category provided", () => {
    const assets: AssetData[] = [
      {
        ticker: "TEST",
        price: 200,
        ma20: 100,
        secondaryIndicator: 50,
        timestamp: new Date().toISOString(),
      },
    ];

    const flags = computeQualityFlags({
      missingTickers: [],
      macroFallback: false,
      assets,
      category: "stocks",
    });

    expect(flags.outlier_values).toHaveLength(1);
    expect(flags.outlier_values![0].ticker).toBe("TEST");
  });
});

describe("hasQualityIssues", () => {
  it("should return false when no issues", () => {
    expect(hasQualityIssues({})).toBe(false);
  });

  it("should return true when missing_assets", () => {
    expect(hasQualityIssues({ missing_assets: ["BTC"] })).toBe(true);
  });

  it("should return true when macro_fallback", () => {
    expect(hasQualityIssues({ macro_fallback: true })).toBe(true);
  });

  it("should return true when macro_stale", () => {
    expect(hasQualityIssues({ macro_stale: true })).toBe(true);
  });

  it("should return true when stale_assets", () => {
    expect(hasQualityIssues({ stale_assets: ["NVDA"] })).toBe(true);
  });

  it("should return true when outlier_values", () => {
    expect(hasQualityIssues({
      outlier_values: [{ ticker: "TEST", field: "price", value: 100, reason: "test" }]
    })).toBe(true);
  });
});

describe("OUTLIER_THRESHOLDS", () => {
  it("should have expected threshold values", () => {
    expect(OUTLIER_THRESHOLDS.PRICE_MA_DEVIATION_MAX).toBe(0.5);
    expect(OUTLIER_THRESHOLDS.RSI_MIN).toBe(5);
    expect(OUTLIER_THRESHOLDS.RSI_MAX).toBe(95);
    expect(OUTLIER_THRESHOLDS.FUNDING_RATE_MAX).toBe(0.01);
  });
});
