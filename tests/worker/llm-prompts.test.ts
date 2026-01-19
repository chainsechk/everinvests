import { describe, it, expect } from "vitest";
import {
  getPrompt,
  getLatestPrompt,
  getAllPrompts,
  buildPromptFromRegistry,
  DEFAULT_PROMPT_NAME,
  DEFAULT_PROMPT_VERSION,
  type PromptInput,
} from "../../worker/src/llm/prompts";
import type { Bias, Category, MacroSignal, AssetSignal } from "../../worker/src/types";

const mockInput: PromptInput = {
  category: "crypto" as Category,
  bias: "Bullish" as Bias,
  macro: {
    dxyBias: "weak",
    vixLevel: "risk_on",
    yieldsBias: "stable",
    overall: "Risk-on",
  } as MacroSignal,
  assets: [
    {
      ticker: "BTC",
      bias: "Bullish" as Bias,
      vsMA20: "above",
      secondaryInd: "0.01%",
      price: 95000,
      reasoning: "Strong momentum",
    },
    {
      ticker: "ETH",
      bias: "Neutral" as Bias,
      vsMA20: "above",
      secondaryInd: "0.005%",
      price: 3500,
      reasoning: "Consolidating",
    },
  ] as AssetSignal[],
  levels: { BTC: 95000, ETH: 3500 },
  risks: ["Regulatory uncertainty", "Fed policy"],
};

describe("Prompt Registry", () => {
  describe("getAllPrompts", () => {
    it("should return registered prompt versions", () => {
      const prompts = getAllPrompts();

      expect(prompts.length).toBeGreaterThan(0);
      expect(prompts[0]).toHaveProperty("name");
      expect(prompts[0]).toHaveProperty("version");
      expect(prompts[0]).toHaveProperty("template");
      expect(prompts[0]).toHaveProperty("createdAt");
    });

    it("should have signal_summary prompt registered", () => {
      const prompts = getAllPrompts();
      const signalSummaryPrompts = prompts.filter(p => p.name === "signal_summary");

      expect(signalSummaryPrompts.length).toBeGreaterThan(0);
    });
  });

  describe("getPrompt", () => {
    it("should return specific prompt version", () => {
      const prompt = getPrompt("signal_summary", "1");

      expect(prompt).toBeDefined();
      expect(prompt!.name).toBe("signal_summary");
      expect(prompt!.version).toBe("1");
    });

    it("should return undefined for non-existent prompt", () => {
      const prompt = getPrompt("non_existent", "1");

      expect(prompt).toBeUndefined();
    });

    it("should return undefined for non-existent version", () => {
      const prompt = getPrompt("signal_summary", "999");

      expect(prompt).toBeUndefined();
    });
  });

  describe("getLatestPrompt", () => {
    it("should return latest version of prompt", () => {
      const prompt = getLatestPrompt("signal_summary");

      expect(prompt).toBeDefined();
      expect(prompt!.name).toBe("signal_summary");
      // Version 2 should be latest
      expect(prompt!.version).toBe("2");
    });

    it("should return undefined for non-existent prompt name", () => {
      const prompt = getLatestPrompt("non_existent");

      expect(prompt).toBeUndefined();
    });
  });

  describe("buildPromptFromRegistry", () => {
    it("should build prompt from default template", () => {
      const result = buildPromptFromRegistry(mockInput);

      expect(result.prompt).toContain("Bullish");
      expect(result.prompt.toLowerCase()).toContain("crypto");
      expect(result.prompt).toContain("BTC");
      expect(result.prompt).toContain("ETH");
      expect(result.promptVersion.name).toBe(DEFAULT_PROMPT_NAME);
    });

    it("should build prompt from specific version", () => {
      const result = buildPromptFromRegistry(mockInput, "signal_summary", "1");

      expect(result.prompt).toContain("professional market analyst");
      expect(result.promptVersion.version).toBe("1");
    });

    it("should include macro context in prompt", () => {
      const result = buildPromptFromRegistry(mockInput);

      expect(result.prompt).toContain("DXY");
      expect(result.prompt.toLowerCase()).toContain("weak");
      expect(result.prompt).toContain("VIX");
      expect(result.prompt.toLowerCase()).toContain("risk_on");
    });

    it("should include risks in prompt", () => {
      const result = buildPromptFromRegistry(mockInput);

      expect(result.prompt).toContain("Regulatory uncertainty");
      expect(result.prompt).toContain("Fed policy");
    });

    it("should use Funding label for crypto", () => {
      const result = buildPromptFromRegistry(mockInput);

      expect(result.prompt).toContain("Funding");
    });

    it("should use RSI label for stocks", () => {
      const stockInput = {
        ...mockInput,
        category: "stocks" as Category,
      };
      const result = buildPromptFromRegistry(stockInput);

      expect(result.prompt).toContain("RSI");
    });

    it("should throw for non-existent prompt", () => {
      expect(() => {
        buildPromptFromRegistry(mockInput, "non_existent", "1");
      }).toThrow("Prompt not found");
    });
  });

  describe("DEFAULT constants", () => {
    it("should have valid default prompt name", () => {
      expect(DEFAULT_PROMPT_NAME).toBe("signal_summary");
    });

    it("should have valid default prompt version", () => {
      expect(DEFAULT_PROMPT_VERSION).toBe("2");
    });
  });
});
