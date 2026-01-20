import { describe, it, expect } from "vitest";
import { computeDelta, formatDeltaSummary } from "../../worker/src/signals/delta";
import type { AssetSignal, Bias } from "../../worker/src/types";

describe("computeDelta", () => {
  const createAssetSignal = (
    ticker: string,
    price: number,
    bias: Bias
  ): AssetSignal => ({
    ticker,
    price,
    bias,
    vsMA20: price > 100 ? "above" : "below",
    secondaryInd: "50.0",
  });

  it("returns null previousBias when no previous signal exists", () => {
    const currentAssets: AssetSignal[] = [
      createAssetSignal("BTC", 50000, "Bullish"),
      createAssetSignal("ETH", 3000, "Neutral"),
    ];

    const delta = computeDelta("Bullish", currentAssets, null);

    expect(delta.biasChanged).toBe(false);
    expect(delta.previousBias).toBe(null);
    expect(delta.currentBias).toBe("Bullish");
    expect(delta.assetDeltas).toHaveLength(2);
    expect(delta.assetDeltas[0].priceDelta).toBe(0);
    expect(delta.changedAssets).toBe(0);
  });

  it("detects bias change", () => {
    const currentAssets: AssetSignal[] = [
      createAssetSignal("BTC", 52000, "Bullish"),
    ];
    const previous = {
      bias: "Bearish" as Bias,
      assets: [{ ticker: "BTC", price: 50000, bias: "Bearish" as Bias }],
    };

    const delta = computeDelta("Bullish", currentAssets, previous);

    expect(delta.biasChanged).toBe(true);
    expect(delta.previousBias).toBe("Bearish");
    expect(delta.currentBias).toBe("Bullish");
  });

  it("computes price delta correctly", () => {
    const currentAssets: AssetSignal[] = [
      createAssetSignal("BTC", 55000, "Bullish"),
      createAssetSignal("ETH", 2850, "Bearish"),
    ];
    const previous = {
      bias: "Bullish" as Bias,
      assets: [
        { ticker: "BTC", price: 50000, bias: "Bullish" as Bias },
        { ticker: "ETH", price: 3000, bias: "Neutral" as Bias },
      ],
    };

    const delta = computeDelta("Bullish", currentAssets, previous);

    const btcDelta = delta.assetDeltas.find((d) => d.ticker === "BTC");
    const ethDelta = delta.assetDeltas.find((d) => d.ticker === "ETH");

    expect(btcDelta?.priceDelta).toBe(10); // +10%
    expect(ethDelta?.priceDelta).toBe(-5); // -5%
  });

  it("identifies biggest gainers and losers", () => {
    const currentAssets: AssetSignal[] = [
      createAssetSignal("BTC", 55000, "Bullish"),
      createAssetSignal("ETH", 2700, "Bearish"),
      createAssetSignal("SOL", 120, "Neutral"),
    ];
    const previous = {
      bias: "Bullish" as Bias,
      assets: [
        { ticker: "BTC", price: 50000, bias: "Bullish" as Bias },
        { ticker: "ETH", price: 3000, bias: "Neutral" as Bias },
        { ticker: "SOL", price: 100, bias: "Neutral" as Bias },
      ],
    };

    const delta = computeDelta("Bullish", currentAssets, previous);

    expect(delta.priceMovers.biggest_gainer?.ticker).toBe("SOL"); // +20%
    expect(delta.priceMovers.biggest_gainer?.delta).toBe(20);
    expect(delta.priceMovers.biggest_loser?.ticker).toBe("ETH"); // -10%
    expect(delta.priceMovers.biggest_loser?.delta).toBe(-10);
  });

  it("counts assets that changed bias", () => {
    const currentAssets: AssetSignal[] = [
      createAssetSignal("BTC", 50000, "Bullish"),
      createAssetSignal("ETH", 3000, "Bearish"),
      createAssetSignal("SOL", 100, "Neutral"),
    ];
    const previous = {
      bias: "Neutral" as Bias,
      assets: [
        { ticker: "BTC", price: 50000, bias: "Neutral" as Bias },
        { ticker: "ETH", price: 3000, bias: "Neutral" as Bias },
        { ticker: "SOL", price: 100, bias: "Neutral" as Bias },
      ],
    };

    const delta = computeDelta("Neutral", currentAssets, previous);

    expect(delta.changedAssets).toBe(2); // BTC and ETH changed
    expect(delta.totalAssets).toBe(3);
  });
});

describe("formatDeltaSummary", () => {
  it("returns 'No significant changes' for first signal", () => {
    const delta = computeDelta(
      "Bullish",
      [{ ticker: "BTC", price: 50000, bias: "Bullish", vsMA20: "above", secondaryInd: "50" }],
      null
    );

    const summary = formatDeltaSummary(delta);
    expect(summary).toBe("No significant changes");
  });

  it("includes bias change when applicable", () => {
    const delta = computeDelta(
      "Bullish",
      [{ ticker: "BTC", price: 55000, bias: "Bullish", vsMA20: "above", secondaryInd: "50" }],
      {
        bias: "Bearish",
        assets: [{ ticker: "BTC", price: 50000, bias: "Bearish" }],
      }
    );

    const summary = formatDeltaSummary(delta);
    expect(summary).toContain("Bearish → Bullish");
  });

  it("includes movers in summary", () => {
    const delta = computeDelta(
      "Bullish",
      [
        { ticker: "BTC", price: 55000, bias: "Bullish", vsMA20: "above", secondaryInd: "50" },
        { ticker: "ETH", price: 2700, bias: "Bearish", vsMA20: "below", secondaryInd: "30" },
      ],
      {
        bias: "Bullish",
        assets: [
          { ticker: "BTC", price: 50000, bias: "Bullish" },
          { ticker: "ETH", price: 3000, bias: "Neutral" },
        ],
      }
    );

    const summary = formatDeltaSummary(delta);
    expect(summary).toContain("BTC +10.0%");
    expect(summary).toContain("ETH -10.0%");
  });
});
