// LLM summary generation with provenance tracking
// Crypto/Forex: Workers AI (Llama 3.1 8B)
// Stocks: DeepSeek V3 via OpenRouter

import type { AssetSignal, Bias, Category, MacroSignal } from "../types";
import {
  buildPromptFromRegistry,
  DEFAULT_PROMPT_NAME,
  DEFAULT_PROMPT_VERSION,
  type PromptInput,
  type PromptVersion,
} from "./prompts";
import { validateSummary, sanitizeSummary, type ValidationResult } from "./validation";

export interface SummaryInput {
  category: Category;
  bias: Bias;
  macro: MacroSignal;
  assets: AssetSignal[];
  levels: Record<string, number>;
  risks: string[];
}

export interface LLMRunResult {
  summary: string;
  promptName: string;
  promptVersion: string;
  model: string;
  tokensIn: number | null;
  tokensOut: number | null;
  latencyMs: number;
  status: "success" | "error" | "fallback";
  errorMsg?: string;
  fallbackReason?: string;
  validation?: ValidationResult;
  sanitized?: boolean;
}

// Model identifiers
const WORKERS_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct";
const OPENROUTER_MODEL = "deepseek/deepseek-chat";

// Generate summary using Workers AI
async function generateSummaryWorkersAI(
  ai: Ai,
  prompt: string,
  promptVersion: PromptVersion
): Promise<LLMRunResult> {
  const startTime = Date.now();

  try {
    const response = await ai.run(
      WORKERS_AI_MODEL as any,
      {
        prompt,
        max_tokens: 100,
        temperature: 0.7,
      }
    );

    const text = (response as { response: string }).response;
    const latencyMs = Date.now() - startTime;

    return {
      summary: text.trim(),
      promptName: promptVersion.name,
      promptVersion: promptVersion.version,
      model: WORKERS_AI_MODEL,
      tokensIn: null, // Workers AI doesn't return token counts
      tokensOut: null,
      latencyMs,
      status: "success",
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);

    return {
      summary: "",
      promptName: promptVersion.name,
      promptVersion: promptVersion.version,
      model: WORKERS_AI_MODEL,
      tokensIn: null,
      tokensOut: null,
      latencyMs,
      status: "error",
      errorMsg,
    };
  }
}

// Generate summary using OpenRouter (DeepSeek V3)
async function generateSummaryOpenRouter(
  apiKey: string,
  prompt: string,
  promptVersion: PromptVersion
): Promise<LLMRunResult> {
  const startTime = Date.now();

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://everinvests.com",
        "X-Title": "EverInvests Signal Generator",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: "user", content: prompt }
        ],
        max_tokens: 100,
        temperature: 0.7,
      }),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      return {
        summary: "",
        promptName: promptVersion.name,
        promptVersion: promptVersion.version,
        model: OPENROUTER_MODEL,
        tokensIn: null,
        tokensOut: null,
        latencyMs,
        status: "error",
        errorMsg: `OpenRouter HTTP ${response.status}`,
      };
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const summary = data.choices[0]?.message?.content?.trim() || "";

    return {
      summary,
      promptName: promptVersion.name,
      promptVersion: promptVersion.version,
      model: OPENROUTER_MODEL,
      tokensIn: data.usage?.prompt_tokens ?? null,
      tokensOut: data.usage?.completion_tokens ?? null,
      latencyMs,
      status: summary ? "success" : "error",
      errorMsg: summary ? undefined : "Empty response from OpenRouter",
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);

    return {
      summary: "",
      promptName: promptVersion.name,
      promptVersion: promptVersion.version,
      model: OPENROUTER_MODEL,
      tokensIn: null,
      tokensOut: null,
      latencyMs,
      status: "error",
      errorMsg,
    };
  }
}

// Fallback summary if LLM fails
function generateFallbackSummary(
  input: SummaryInput,
  fallbackReason: string
): LLMRunResult {
  const bullishCount = input.assets.filter(a => a.bias === "Bullish").length;
  const bearishCount = input.assets.filter(a => a.bias === "Bearish").length;
  const total = input.assets.length;

  let summary = `${input.category.charAt(0).toUpperCase() + input.category.slice(1)} signals ${input.bias.toLowerCase()} `;

  if (bullishCount > 0 && bearishCount > 0) {
    summary += `with mixed readings across ${total} assets. `;
  } else if (bullishCount === total) {
    summary += `with all ${total} assets showing strength. `;
  } else if (bearishCount === total) {
    summary += `with all ${total} assets showing weakness. `;
  } else {
    summary += `based on ${total} asset analysis. `;
  }

  summary += `Macro environment is ${input.macro.overall.toLowerCase()}.`;

  return {
    summary,
    promptName: DEFAULT_PROMPT_NAME,
    promptVersion: DEFAULT_PROMPT_VERSION,
    model: "fallback",
    tokensIn: null,
    tokensOut: null,
    latencyMs: 0,
    status: "fallback",
    fallbackReason,
  };
}

// Main entry point - routes to appropriate LLM with provenance tracking
export async function generateSummary(
  input: SummaryInput,
  ai?: Ai,
  openRouterKey?: string,
  promptName: string = DEFAULT_PROMPT_NAME,
  promptVersion?: string
): Promise<LLMRunResult> {
  // Build prompt from registry
  let prompt: string;
  let version: PromptVersion;

  try {
    const result = buildPromptFromRegistry(input as PromptInput, promptName, promptVersion);
    prompt = result.prompt;
    version = result.promptVersion;
  } catch (error) {
    return generateFallbackSummary(
      input,
      `Prompt not found: ${promptName}@${promptVersion || "latest"}`
    );
  }

  // Route to appropriate LLM
  let result: LLMRunResult;

  if (input.category === "stocks" && openRouterKey) {
    result = await generateSummaryOpenRouter(openRouterKey, prompt, version);
  } else if (ai) {
    result = await generateSummaryWorkersAI(ai, prompt, version);
  } else {
    return generateFallbackSummary(input, "No LLM available");
  }

  // If LLM failed, use fallback
  if (result.status === "error" || !result.summary) {
    const fallback = generateFallbackSummary(
      input,
      result.errorMsg || "LLM returned empty response"
    );
    // Preserve original LLM run info but mark as fallback
    return {
      ...fallback,
      promptName: result.promptName,
      promptVersion: result.promptVersion,
      latencyMs: result.latencyMs,
      errorMsg: result.errorMsg,
    };
  }

  // Validate and sanitize the summary
  const validation = validateSummary(result.summary);
  result.validation = validation;

  if (!validation.valid) {
    // Try sanitizing first
    const sanitized = sanitizeSummary(result.summary);
    const revalidation = validateSummary(sanitized);

    if (revalidation.valid) {
      // Sanitization fixed the issues
      result.summary = sanitized;
      result.sanitized = true;
      result.validation = revalidation;
    } else {
      // Sanitization didn't help - use fallback
      const fallback = generateFallbackSummary(
        input,
        `Validation failed: ${validation.issues.map(i => i.code).join(", ")}`
      );
      return {
        ...fallback,
        promptName: result.promptName,
        promptVersion: result.promptVersion,
        latencyMs: result.latencyMs,
        validation,
      };
    }
  }

  return result;
}

// Re-export types from prompts for external use
export type { PromptInput, PromptVersion } from "./prompts";
export {
  DEFAULT_PROMPT_NAME,
  DEFAULT_PROMPT_VERSION,
  getAllPrompts,
  getPromptsForSeeding,
} from "./prompts";
