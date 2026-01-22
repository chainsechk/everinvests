// Versioned prompt templates for LLM summary generation
// Each prompt has a name, version, and template function

import type { AssetSignal, Bias, Category, MacroSignal } from "../types";

export interface PromptInput {
  category: Category;
  bias: Bias;
  macro: MacroSignal;
  assets: AssetSignal[];
  levels: Record<string, number>;
  risks: string[];
}

export interface PromptVersion {
  name: string;
  version: string;
  template: (input: PromptInput) => string;
  createdAt: string;
}

// Prompt version registry
const promptVersions: Map<string, PromptVersion> = new Map();

// Helper to create prompt key
function promptKey(name: string, version: string): string {
  return `${name}@${version}`;
}

// Register a prompt version
function registerPrompt(prompt: PromptVersion): void {
  promptVersions.set(promptKey(prompt.name, prompt.version), prompt);
}

// Get a specific prompt version
export function getPrompt(name: string, version: string): PromptVersion | undefined {
  return promptVersions.get(promptKey(name, version));
}

// Get latest version of a prompt by name
export function getLatestPrompt(name: string): PromptVersion | undefined {
  let latest: PromptVersion | undefined;
  for (const prompt of promptVersions.values()) {
    if (prompt.name === name) {
      if (!latest || prompt.version > latest.version) {
        latest = prompt;
      }
    }
  }
  return latest;
}

// Get all registered prompts
export function getAllPrompts(): PromptVersion[] {
  return Array.from(promptVersions.values());
}

// Get prompts for DB seeding (static template representation)
export function getPromptsForSeeding(): Array<{
  name: string;
  version: string;
  template: string;
  createdAt: string;
}> {
  return getAllPrompts().map(p => ({
    name: p.name,
    version: p.version,
    template: p.template.toString(),
    createdAt: p.createdAt,
  }));
}

// ============================================================
// PROMPT DEFINITIONS
// ============================================================

// Signal Summary v1 - Original prompt
registerPrompt({
  name: "signal_summary",
  version: "1",
  createdAt: "2026-01-14T00:00:00Z",
  template: (input: PromptInput): string => {
    const secondaryLabel = input.category === "crypto" ? "Funding" : "RSI(14)";
    const assetSummary = input.assets
      .map(a => `${a.ticker}: ${a.bias} (${a.vsMA20} 20D MA, ${secondaryLabel}: ${a.secondaryInd})`)
      .join(", ");

    return `You are a professional market analyst. Generate a 1-2 sentence summary for today's ${input.category} signal.

Macro context: ${input.macro.overall} (DXY: ${input.macro.dxyBias}, VIX: ${input.macro.vixLevel})
Overall bias: ${input.bias}
Assets: ${assetSummary}
Key risks: ${input.risks.join(", ")}

Write a concise, professional summary that a trader would find useful.
- Use only the data provided above; do not invent indicators (e.g., Fibonacci levels).
- If macro context is "Unavailable", do not make macro claims.
- Do not use emojis or markdown.`;
  },
});

// Signal Summary v2 - Enhanced with structured output guidance
registerPrompt({
  name: "signal_summary",
  version: "2",
  createdAt: "2026-01-19T00:00:00Z",
  template: (input: PromptInput): string => {
    const secondaryLabel = input.category === "crypto" ? "Funding Rate" : "RSI(14)";
    const assetSummary = input.assets
      .map(a => `${a.ticker}: ${a.bias} (vs 20D MA: ${a.vsMA20}, ${secondaryLabel}: ${a.secondaryInd})`)
      .join("\n- ");

    const categoryLabel = input.category.charAt(0).toUpperCase() + input.category.slice(1);

    return `You are a professional market analyst writing daily signal summaries.

CATEGORY: ${categoryLabel}
OVERALL BIAS: ${input.bias}

MACRO CONTEXT:
- Overall: ${input.macro.overall}
- DXY (Dollar Index): ${input.macro.dxyBias}
- VIX (Volatility): ${input.macro.vixLevel}

ASSETS:
- ${assetSummary}

KEY RISKS: ${input.risks.length > 0 ? input.risks.join(", ") : "None identified"}

TASK: Write a 1-2 sentence summary for traders.

RULES:
1. Only reference data provided above - no invented indicators
2. If macro context shows "Unavailable", omit macro commentary
3. No emojis, no markdown formatting
4. Be direct and actionable
5. Mention the bias and key driver(s)`;
  },
});

// Signal Summary v3 - Clarify secondary indicators per category
registerPrompt({
  name: "signal_summary",
  version: "3",
  createdAt: "2026-01-23T00:00:00Z",
  template: (input: PromptInput): string => {
    const categoryLabel = input.category.charAt(0).toUpperCase() + input.category.slice(1);

    function formatSecondary(value: string): string {
      if (input.category === "crypto") {
        if (value.startsWith("F&G:")) {
          return `Sentiment (Fear & Greed): ${value.slice(4)}`;
        }
        return `Funding Rate: ${value}`;
      }
      if (input.category === "forex") {
        if (value.startsWith("YC:")) {
          return `Yield Curve: ${value.slice(3)}`;
        }
        return `RSI(14): ${value}`;
      }
      return `RSI(14): ${value}`;
    }

    const assetSummary = input.assets
      .map(a => `${a.ticker}: ${a.bias} (vs 20D MA: ${a.vsMA20}, ${formatSecondary(a.secondaryInd)})`)
      .join("\n- ");

    return `You are a professional market analyst writing daily signal summaries.

CATEGORY: ${categoryLabel}
OVERALL BIAS: ${input.bias}

MACRO CONTEXT:
- Overall: ${input.macro.overall}
- DXY (Dollar Index): ${input.macro.dxyBias}
- VIX (Volatility): ${input.macro.vixLevel}

ASSETS:
- ${assetSummary}

KEY RISKS: ${input.risks.length > 0 ? input.risks.join(", ") : "None identified"}

TASK: Write a 1-2 sentence summary for traders.

RULES:
1. Only reference data provided above - no invented indicators
2. If macro context shows "Unavailable", omit macro commentary
3. No emojis, no markdown formatting
4. Be direct and actionable
5. Mention the bias and key driver(s)`;
  },
});

// Default prompt name and version to use
export const DEFAULT_PROMPT_NAME = "signal_summary";
export const DEFAULT_PROMPT_VERSION = "3";

// Build prompt using the registry
export function buildPromptFromRegistry(
  input: PromptInput,
  promptName: string = DEFAULT_PROMPT_NAME,
  promptVersion?: string
): { prompt: string; promptVersion: PromptVersion } {
  const version = promptVersion
    ? getPrompt(promptName, promptVersion)
    : getLatestPrompt(promptName);

  if (!version) {
    throw new Error(`Prompt not found: ${promptName}@${promptVersion || "latest"}`);
  }

  return {
    prompt: version.template(input),
    promptVersion: version,
  };
}
