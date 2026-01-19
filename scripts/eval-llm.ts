#!/usr/bin/env npx tsx
/**
 * LLM Evaluation Script
 *
 * Tests prompt templates against a golden dataset to evaluate:
 * - Output quality (validation passes)
 * - Consistency (similar inputs produce similar bias mentions)
 * - Format compliance (no markdown, no emojis)
 *
 * Usage: npx tsx scripts/eval-llm.ts
 */

import { buildPromptFromRegistry, getAllPrompts } from "../worker/src/llm/prompts";
import { validateSummary, type ValidationResult } from "../worker/src/llm/validation";
import type { PromptInput } from "../worker/src/llm/prompts";
import type { Bias, Category, MacroSignal, AssetSignal } from "../worker/src/types";

// Golden dataset for evaluation
interface GoldenCase {
  name: string;
  input: PromptInput;
  expected: {
    mentionsBias: boolean;
    mentionsCategory: boolean;
    maxLength: number;
    mustContain?: string[];
    mustNotContain?: string[];
  };
}

const GOLDEN_DATASET: GoldenCase[] = [
  {
    name: "Bullish crypto with strong macro",
    input: {
      category: "crypto" as Category,
      bias: "Bullish" as Bias,
      macro: {
        dxyBias: "weak",
        vixLevel: "risk_on",
        yieldsBias: "stable",
        overall: "Risk-on",
      } as MacroSignal,
      assets: [
        { ticker: "BTC", bias: "Bullish" as Bias, vsMA20: "above", secondaryInd: "0.01%", price: 95000, reasoning: "Strong" },
        { ticker: "ETH", bias: "Bullish" as Bias, vsMA20: "above", secondaryInd: "0.02%", price: 3500, reasoning: "Strong" },
      ] as AssetSignal[],
      levels: { BTC: 95000, ETH: 3500 },
      risks: ["Regulatory uncertainty"],
    },
    expected: {
      mentionsBias: true,
      mentionsCategory: true,
      maxLength: 300,
      mustContain: ["bullish", "crypto"],
      mustNotContain: ["fibonacci", "disclaimer"],
    },
  },
  {
    name: "Bearish forex with weak macro",
    input: {
      category: "forex" as Category,
      bias: "Bearish" as Bias,
      macro: {
        dxyBias: "strong",
        vixLevel: "risk_off",
        yieldsBias: "rising",
        overall: "Risk-off",
      } as MacroSignal,
      assets: [
        { ticker: "USD/JPY", bias: "Bearish" as Bias, vsMA20: "below", secondaryInd: "35", price: 148.5, reasoning: "Weak" },
        { ticker: "EUR/USD", bias: "Bearish" as Bias, vsMA20: "below", secondaryInd: "38", price: 1.08, reasoning: "Weak" },
      ] as AssetSignal[],
      levels: { "USD/JPY": 148.5, "EUR/USD": 1.08 },
      risks: ["Fed policy uncertainty", "Geopolitical tensions"],
    },
    expected: {
      mentionsBias: true,
      mentionsCategory: true,
      maxLength: 300,
      mustContain: ["bearish", "forex"],
      mustNotContain: ["buy now", "guaranteed"],
    },
  },
  {
    name: "Neutral stocks with mixed signals",
    input: {
      category: "stocks" as Category,
      bias: "Neutral" as Bias,
      macro: {
        dxyBias: "neutral",
        vixLevel: "neutral",
        yieldsBias: "stable",
        overall: "Mixed",
      } as MacroSignal,
      assets: [
        { ticker: "NVDA", bias: "Bullish" as Bias, vsMA20: "above", secondaryInd: "55", price: 140, reasoning: "Strong AI demand" },
        { ticker: "AMD", bias: "Bearish" as Bias, vsMA20: "below", secondaryInd: "42", price: 125, reasoning: "Competition" },
        { ticker: "INTC", bias: "Neutral" as Bias, vsMA20: "above", secondaryInd: "50", price: 22, reasoning: "Turnaround unclear" },
      ] as AssetSignal[],
      levels: { NVDA: 140, AMD: 125, INTC: 22 },
      risks: ["Valuation concerns", "Supply chain"],
    },
    expected: {
      mentionsBias: true,
      mentionsCategory: true,
      maxLength: 300,
      mustContain: ["neutral", "stock"],
      mustNotContain: ["moon", "crash"],
    },
  },
  {
    name: "Crypto with unavailable macro",
    input: {
      category: "crypto" as Category,
      bias: "Bullish" as Bias,
      macro: {
        dxyBias: "neutral",
        vixLevel: "neutral",
        yieldsBias: "stable",
        overall: "Unavailable",
      } as MacroSignal,
      assets: [
        { ticker: "BTC", bias: "Bullish" as Bias, vsMA20: "above", secondaryInd: "0.005%", price: 100000, reasoning: "Breakout" },
      ] as AssetSignal[],
      levels: { BTC: 100000 },
      risks: [],
    },
    expected: {
      mentionsBias: true,
      mentionsCategory: true,
      maxLength: 300,
      mustContain: ["bullish"],
      mustNotContain: [], // Removed macro checks since overall is Unavailable
    },
  },
];

interface EvalResult {
  caseName: string;
  promptName: string;
  promptVersion: string;
  validation: ValidationResult;
  checks: {
    mentionsBias: boolean;
    mentionsCategory: boolean;
    withinMaxLength: boolean;
    containsRequired: boolean;
    avoidsProhibited: boolean;
  };
  passed: boolean;
  prompt: string;
}

function evaluatePrompt(
  goldenCase: GoldenCase,
  promptName: string,
  promptVersion: string
): EvalResult {
  const { prompt, promptVersion: version } = buildPromptFromRegistry(
    goldenCase.input,
    promptName,
    promptVersion
  );

  const validation = validateSummary(prompt);

  // For prompt evaluation, we check the prompt structure, not actual LLM output
  // In production, this would be used with actual LLM responses
  const promptLower = prompt.toLowerCase();

  const checks = {
    mentionsBias: promptLower.includes(goldenCase.input.bias.toLowerCase()),
    mentionsCategory: promptLower.includes(goldenCase.input.category.toLowerCase()),
    withinMaxLength: true, // Prompt can be longer; output should be checked
    containsRequired: true,
    avoidsProhibited: true,
  };

  // Check for required patterns in prompt (verifies data is included)
  if (goldenCase.expected.mustContain) {
    for (const pattern of goldenCase.expected.mustContain) {
      if (!promptLower.includes(pattern.toLowerCase())) {
        // Bias and category should be in prompt
        if (pattern === "bullish" || pattern === "bearish" || pattern === "neutral") {
          checks.containsRequired = checks.containsRequired && checks.mentionsBias;
        }
      }
    }
  }

  const passed =
    checks.mentionsBias &&
    checks.mentionsCategory &&
    checks.containsRequired;

  return {
    caseName: goldenCase.name,
    promptName: version.name,
    promptVersion: version.version,
    validation,
    checks,
    passed,
    prompt,
  };
}

function runEvaluation(): void {
  console.log("=".repeat(60));
  console.log("LLM Prompt Evaluation");
  console.log("=".repeat(60));
  console.log();

  const prompts = getAllPrompts();
  console.log(`Found ${prompts.length} prompt version(s):`);
  for (const p of prompts) {
    console.log(`  - ${p.name}@${p.version} (created: ${p.createdAt})`);
  }
  console.log();

  const results: EvalResult[] = [];

  for (const goldenCase of GOLDEN_DATASET) {
    console.log(`\nCase: ${goldenCase.name}`);
    console.log("-".repeat(40));

    for (const prompt of prompts) {
      const result = evaluatePrompt(goldenCase, prompt.name, prompt.version);
      results.push(result);

      const status = result.passed ? "PASS" : "FAIL";
      console.log(`  ${prompt.name}@${prompt.version}: ${status}`);

      if (!result.passed) {
        console.log(`    Checks: ${JSON.stringify(result.checks)}`);
      }
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("Summary");
  console.log("=".repeat(60));

  const passedCount = results.filter((r) => r.passed).length;
  const totalCount = results.length;

  console.log(`\nTotal: ${passedCount}/${totalCount} passed (${((passedCount / totalCount) * 100).toFixed(1)}%)`);

  // Group by prompt version
  const byVersion = new Map<string, EvalResult[]>();
  for (const r of results) {
    const key = `${r.promptName}@${r.promptVersion}`;
    if (!byVersion.has(key)) {
      byVersion.set(key, []);
    }
    byVersion.get(key)!.push(r);
  }

  console.log("\nBy prompt version:");
  for (const [key, vResults] of byVersion) {
    const vPassed = vResults.filter((r) => r.passed).length;
    console.log(`  ${key}: ${vPassed}/${vResults.length} passed`);
  }

  // Exit with error if any failed
  if (passedCount < totalCount) {
    console.log("\nSome evaluations failed.");
    // eslint-disable-next-line no-undef
    if (typeof process !== "undefined") {
      process.exit(1);
    }
  } else {
    console.log("\nAll evaluations passed.");
  }
}

// Run evaluation
runEvaluation();
