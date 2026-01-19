import { fetchCryptoData, fetchForexData, fetchStockData } from "../data";
import { STOCK_KEY_TICKERS } from "../data/twelvedata";
import type { AssetData, Category } from "../types";
import { CRYPTO_ASSETS, FOREX_ASSETS } from "../types";
import type { SkillSpec } from "./types";

export interface FetchAssetDataOutput {
  assetData: AssetData[];
  expectedTickers: readonly string[];
  missingTickers: string[];
  staleAssets: string[];
  cacheHits: number;
}

export const fetchAssetDataSkill: SkillSpec<void, FetchAssetDataOutput> = {
  id: "fetch_asset_data",
  version: "2",
  async run({ env, ctx }) {
    const category = ctx.category as Category;

    let expectedTickers: readonly string[] = [];
    let assetData: AssetData[] = [];
    let staleAssets: string[] = [];
    let cacheHits = 0;

    if (category === "crypto") {
      expectedTickers = CRYPTO_ASSETS;
      const result = await fetchCryptoData(CRYPTO_ASSETS);
      assetData = result.data;
      staleAssets = result.staleAssets;
      cacheHits = result.cacheHits;
    } else if (category === "forex") {
      expectedTickers = FOREX_ASSETS;
      if (!env.TWELVEDATA_API_KEY) {
        throw new Error("TWELVEDATA_API_KEY not configured");
      }
      const result = await fetchForexData(FOREX_ASSETS, env.TWELVEDATA_API_KEY);
      assetData = result.data;
      staleAssets = result.staleAssets;
      cacheHits = result.cacheHits;
    } else if (category === "stocks") {
      expectedTickers = STOCK_KEY_TICKERS;
      if (!env.TWELVEDATA_API_KEY) {
        throw new Error("TWELVEDATA_API_KEY not configured");
      }
      const result = await fetchStockData(STOCK_KEY_TICKERS, env.TWELVEDATA_API_KEY);
      assetData = result.data;
      staleAssets = result.staleAssets;
      cacheHits = result.cacheHits;
    } else {
      throw new Error(`Unsupported category: ${ctx.category}`);
    }

    const fetched = new Set(assetData.map((a) => a.ticker));
    const missingTickers = expectedTickers.filter((t) => !fetched.has(t));

    return { assetData, expectedTickers, missingTickers, staleAssets, cacheHits };
  },
};
