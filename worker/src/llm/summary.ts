// LLM summary generation
// Crypto/Forex: Workers AI (Llama 3.1 8B)
// Stocks: DeepSeek V3 via OpenRouter

import type { AssetSignal, Bias, Category, MacroSignal } from "../types";

interface SummaryInput {
  category: Category;
  bias: Bias;
  macro: MacroSignal;
  assets: AssetSignal[];
  levels: Record<string, number>;
  risks: string[];
}

// Build prompt for LLM
function buildPrompt(input: SummaryInput): string {
  const assetSummary = input.assets
    .map(a => `${a.ticker}: ${a.bias} (${a.vsMA20} 20D MA, ${a.secondaryInd})`)
    .join(", ");

  return `You are a professional market analyst. Generate a 1-2 sentence summary for today's ${input.category} signal.

Macro context: ${input.macro.overall} (DXY: ${input.macro.dxyBias}, VIX: ${input.macro.vixLevel})
Overall bias: ${input.bias}
Assets: ${assetSummary}
Key risks: ${input.risks.join(", ")}

Write a concise, professional summary that a trader would find useful. Focus on the key takeaway and any notable conditions. Do not use emojis or markdown.`;
}

// Generate summary using Workers AI
export async function generateSummaryWorkersAI(
  ai: Ai,
  input: SummaryInput
): Promise<string> {
  const prompt = buildPrompt(input);

  try {
    const response = await ai.run(
      "@cf/meta/llama-3.1-8b-instruct" as any,
      {
        prompt,
        max_tokens: 100,
        temperature: 0.7,
      }
    );

    // Workers AI returns { response: string }
    const text = (response as { response: string }).response;
    return text.trim();
  } catch (error) {
    console.error("Workers AI failed:", error);
    return generateFallbackSummary(input);
  }
}

// Generate summary using OpenRouter (DeepSeek V3)
export async function generateSummaryOpenRouter(
  apiKey: string,
  input: SummaryInput
): Promise<string> {
  const prompt = buildPrompt(input);

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
        model: "deepseek/deepseek-chat",
        messages: [
          { role: "user", content: prompt }
        ],
        max_tokens: 100,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter failed: ${response.status}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    return data.choices[0]?.message?.content?.trim() || generateFallbackSummary(input);
  } catch (error) {
    console.error("OpenRouter failed:", error);
    return generateFallbackSummary(input);
  }
}

// Fallback summary if LLM fails
function generateFallbackSummary(input: SummaryInput): string {
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

  return summary;
}

// Main entry point - routes to appropriate LLM
export async function generateSummary(
  input: SummaryInput,
  ai?: Ai,
  openRouterKey?: string
): Promise<string> {
  // Stocks use OpenRouter (DeepSeek), crypto/forex use Workers AI
  if (input.category === "stocks" && openRouterKey) {
    return generateSummaryOpenRouter(openRouterKey, input);
  } else if (ai) {
    return generateSummaryWorkersAI(ai, input);
  } else {
    return generateFallbackSummary(input);
  }
}
