import { describe, it, expect } from "vitest";
import {
  validateSummary,
  sanitizeSummary,
  meetsMinimumQuality,
} from "../../worker/src/llm/validation";

describe("validateSummary", () => {
  describe("length checks", () => {
    it("should pass valid summary length", () => {
      const summary = "Crypto signals bullish with strong momentum across both BTC and ETH. Macro environment supports risk-on positioning.";
      const result = validateSummary(summary);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it("should fail too short summary", () => {
      const summary = "Short summary.";
      const result = validateSummary(summary);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.code === "TOO_SHORT")).toBe(true);
    });

    it("should fail empty summary", () => {
      const summary = "";
      const result = validateSummary(summary);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.code === "EMPTY")).toBe(true);
    });

    it("should warn on too long summary", () => {
      const summary = "A".repeat(350);
      const result = validateSummary(summary);

      expect(result.issues.some(i => i.code === "TOO_LONG")).toBe(true);
      expect(result.issues.find(i => i.code === "TOO_LONG")?.severity).toBe("warning");
    });
  });

  describe("forbidden patterns", () => {
    it("should fail on fibonacci mention", () => {
      const summary = "BTC shows bullish signals with fibonacci retracement at key levels. Momentum remains strong.";
      const result = validateSummary(summary);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.code === "FORBIDDEN_PATTERN")).toBe(true);
    });

    it("should fail on MACD crossover mention", () => {
      const summary = "ETH displays positive momentum with MACD crossover confirming bullish trend. Volume supports the move.";
      const result = validateSummary(summary);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.code === "FORBIDDEN_PATTERN")).toBe(true);
    });

    it("should fail on disclaimer", () => {
      const summary = "BTC bullish signals today. This is not financial advice, please do your own research before trading.";
      const result = validateSummary(summary);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.code === "FORBIDDEN_PATTERN")).toBe(true);
    });

    it("should fail on NFA/DYOR abbreviations", () => {
      const summary = "Stocks showing mixed signals. Strong momentum in tech sector. NFA. Consider your risk tolerance.";
      const result = validateSummary(summary);

      expect(result.valid).toBe(false);
    });
  });

  describe("emoji check", () => {
    it("should fail on emoji", () => {
      const summary = "BTC bullish 🚀 with strong momentum. ETH following with good volume across exchanges today.";
      const result = validateSummary(summary);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.code === "CONTAINS_EMOJI")).toBe(true);
    });

    it("should pass without emoji", () => {
      const summary = "BTC bullish with strong momentum. ETH following with good volume across exchanges today.";
      const result = validateSummary(summary);

      expect(result.issues.some(i => i.code === "CONTAINS_EMOJI")).toBe(false);
    });
  });

  describe("markdown check", () => {
    it("should fail on bold markdown", () => {
      const summary = "**BTC** shows bullish signals with strong momentum. ETH consolidating near support levels today.";
      const result = validateSummary(summary);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.code === "CONTAINS_MARKDOWN")).toBe(true);
    });

    it("should fail on italic markdown", () => {
      const summary = "BTC shows *bullish* signals with strong momentum. ETH consolidating near support levels today.";
      const result = validateSummary(summary);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.code === "CONTAINS_MARKDOWN")).toBe(true);
    });

    it("should fail on code markdown", () => {
      const summary = "BTC at `95000` shows bullish signals. ETH consolidating near support levels today trending higher.";
      const result = validateSummary(summary);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.code === "CONTAINS_MARKDOWN")).toBe(true);
    });
  });

  describe("sensational language", () => {
    it("should warn on guaranteed language", () => {
      const summary = "BTC guaranteed to rise as momentum indicators align. ETH following with strong volume support.";
      const result = validateSummary(summary);

      expect(result.issues.some(i => i.code === "SENSATIONAL_LANGUAGE")).toBe(true);
      expect(result.issues.find(i => i.code === "SENSATIONAL_LANGUAGE")?.severity).toBe("warning");
    });

    it("should warn on moon/lambo language", () => {
      const summary = "BTC mooning with strong momentum across all timeframes. ETH following the trend with volume.";
      const result = validateSummary(summary);

      expect(result.issues.some(i => i.code === "SENSATIONAL_LANGUAGE")).toBe(true);
    });

    it("should warn on buy now language", () => {
      const summary = "Must buy now as BTC shows strong bullish signals. ETH also displaying positive momentum today.";
      const result = validateSummary(summary);

      expect(result.issues.some(i => i.code === "SENSATIONAL_LANGUAGE")).toBe(true);
    });
  });
});

describe("sanitizeSummary", () => {
  it("should remove emojis", () => {
    const summary = "BTC bullish 🚀 with strong momentum 📈";
    const result = sanitizeSummary(summary);

    expect(result).not.toContain("🚀");
    expect(result).not.toContain("📈");
  });

  it("should remove bold markdown", () => {
    const summary = "**BTC** shows **bullish** signals";
    const result = sanitizeSummary(summary);

    expect(result).toBe("BTC shows bullish signals");
  });

  it("should remove italic markdown", () => {
    const summary = "*BTC* shows *bullish* signals";
    const result = sanitizeSummary(summary);

    expect(result).toBe("BTC shows bullish signals");
  });

  it("should remove code markdown", () => {
    const summary = "BTC at `95000` shows signals";
    const result = sanitizeSummary(summary);

    expect(result).toBe("BTC at 95000 shows signals");
  });

  it("should normalize whitespace", () => {
    const summary = "BTC   shows   strong    signals";
    const result = sanitizeSummary(summary);

    expect(result).toBe("BTC shows strong signals");
  });

  it("should trim leading/trailing whitespace", () => {
    const summary = "  BTC shows signals  ";
    const result = sanitizeSummary(summary);

    expect(result).toBe("BTC shows signals");
  });
});

describe("meetsMinimumQuality", () => {
  it("should return true for valid summary", () => {
    const summary = "Crypto signals bullish with strong momentum across both BTC and ETH. Macro environment supports risk-on positioning.";

    expect(meetsMinimumQuality(summary)).toBe(true);
  });

  it("should return false for invalid summary", () => {
    const summary = "Short.";

    expect(meetsMinimumQuality(summary)).toBe(false);
  });

  it("should return false for summary with errors", () => {
    const summary = "BTC shows fibonacci retracement patterns. This is not financial advice, DYOR before trading.";

    expect(meetsMinimumQuality(summary)).toBe(false);
  });

  it("should return true for summary with only warnings", () => {
    // Long summary (warning) but otherwise valid
    const summary = "BTC shows bullish signals with strong momentum across all exchanges. ETH following with good volume. Overall macro environment is supportive. Risk-on positioning favored. DXY weakness supports crypto. VIX at low levels. Multiple technical indicators align positively across the board today.";

    expect(meetsMinimumQuality(summary)).toBe(true);
  });
});
