// Weekly blog summary generation
import type { Env } from "../env";
import type { Category } from "../types";

interface WeeklySignal {
  id: number;
  category: string;
  date: string;
  time_slot: string;
  bias: string;
  output_json: string;
}

interface WeeklySummary {
  category: Category;
  weekStart: string;
  weekEnd: string;
  signals: WeeklySignal[];
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  dominantBias: string;
}

// Get Monday of the current week
function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  d.setUTCDate(diff);
  return d.toISOString().split("T")[0];
}

// Get Sunday of the current week
function getWeekEnd(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() + (day === 0 ? 0 : 7 - day);
  d.setUTCDate(diff);
  return d.toISOString().split("T")[0];
}

// Build prompt for weekly summary
function buildWeeklyPrompt(summary: WeeklySummary): string {
  const categoryTitle = summary.category.charAt(0).toUpperCase() + summary.category.slice(1);

  const signalList = summary.signals
    .map(s => {
      const output = JSON.parse(s.output_json || "{}");
      return `- ${s.date} ${s.time_slot}: ${s.bias} - ${output.summary || "No summary"}`;
    })
    .join("\n");

  return `Write a 300-400 word weekly market analysis blog post for ${categoryTitle}.

Week: ${summary.weekStart} to ${summary.weekEnd}

Signal History:
${signalList}

Statistics:
- Total signals: ${summary.signals.length}
- Bullish: ${summary.bullishCount}
- Bearish: ${summary.bearishCount}
- Neutral: ${summary.neutralCount}
- Dominant bias: ${summary.dominantBias}

Requirements:
- Start with an overview of the week's market action
- Highlight key trends and shifts in bias throughout the week
- Mention notable price movements or events if evident from the signals
- Provide outlook for the coming week based on the trend
- End with: "Get real-time signals on our Telegram channel"
- Professional, analytical tone
- No emojis or markdown formatting
- Do NOT include financial advice disclaimers in the body
- SEO keywords to naturally include: ${summary.category} weekly analysis, ${summary.category} market recap, weekly ${summary.category} signals`;
}

// Generate weekly summary using Workers AI
async function generateWeeklyContentWorkersAI(
  ai: Ai,
  summary: WeeklySummary
): Promise<string> {
  const prompt = buildWeeklyPrompt(summary);

  try {
    const response = await ai.run(
      "@cf/meta/llama-3.1-8b-instruct" as any,
      {
        prompt,
        max_tokens: 600,
        temperature: 0.7,
      }
    );

    const text = (response as { response: string }).response;
    return text.trim();
  } catch (error) {
    console.error("Workers AI weekly blog generation failed:", error);
    return generateFallbackWeeklyContent(summary);
  }
}

// Generate weekly summary using OpenRouter (DeepSeek V3)
async function generateWeeklyContentOpenRouter(
  apiKey: string,
  summary: WeeklySummary
): Promise<string> {
  const prompt = buildWeeklyPrompt(summary);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://everinvests.com",
        "X-Title": "EverInvests Weekly Blog",
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 600,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter failed: ${response.status}`);
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>;
    };

    return data.choices[0]?.message?.content?.trim() || generateFallbackWeeklyContent(summary);
  } catch (error) {
    console.error("OpenRouter weekly blog generation failed:", error);
    return generateFallbackWeeklyContent(summary);
  }
}

// Fallback content if LLM fails
function generateFallbackWeeklyContent(summary: WeeklySummary): string {
  const categoryTitle = summary.category.charAt(0).toUpperCase() + summary.category.slice(1);

  let content = `This week in ${categoryTitle.toLowerCase()} markets (${summary.weekStart} to ${summary.weekEnd}), `;
  content += `we tracked ${summary.signals.length} signals across our analysis windows. `;

  if (summary.bullishCount > summary.bearishCount) {
    content += `The week showed predominantly bullish sentiment with ${summary.bullishCount} bullish signals versus ${summary.bearishCount} bearish. `;
  } else if (summary.bearishCount > summary.bullishCount) {
    content += `The week showed predominantly bearish sentiment with ${summary.bearishCount} bearish signals versus ${summary.bullishCount} bullish. `;
  } else {
    content += `The week showed mixed sentiment with an even distribution of bullish and bearish signals. `;
  }

  content += `\n\nOverall, the dominant bias for the week was ${summary.dominantBias.toLowerCase()}, `;
  content += `suggesting traders should maintain appropriate positioning for current market conditions.\n\n`;
  content += `Get real-time signals on our Telegram channel.`;

  return content;
}

// Main function to generate weekly blog posts
export async function generateWeeklyBlogPosts(env: Env): Promise<void> {
  const now = new Date();
  const weekStart = getWeekStart(now);
  const weekEnd = getWeekEnd(now);

  console.log(`[WeeklyBlog] Generating summaries for week ${weekStart} to ${weekEnd}`);

  const categories: Category[] = ["crypto", "forex", "stocks"];

  for (const category of categories) {
    try {
      // Fetch all signals for this category from the past week
      const result = await env.DB.prepare(
        `SELECT id, category, date, time_slot, bias, output_json
         FROM signals
         WHERE category = ? AND date >= ? AND date <= ?
         ORDER BY date ASC, time_slot ASC`
      ).bind(category, weekStart, weekEnd).all<WeeklySignal>();

      const signals = result.results || [];

      if (signals.length === 0) {
        console.log(`[WeeklyBlog] No signals for ${category} this week, skipping`);
        continue;
      }

      // Calculate statistics
      const bullishCount = signals.filter(s => s.bias === "Bullish").length;
      const bearishCount = signals.filter(s => s.bias === "Bearish").length;
      const neutralCount = signals.filter(s => s.bias === "Neutral").length;

      let dominantBias = "Neutral";
      if (bullishCount > bearishCount && bullishCount > neutralCount) {
        dominantBias = "Bullish";
      } else if (bearishCount > bullishCount && bearishCount > neutralCount) {
        dominantBias = "Bearish";
      }

      const summary: WeeklySummary = {
        category,
        weekStart,
        weekEnd,
        signals,
        bullishCount,
        bearishCount,
        neutralCount,
        dominantBias,
      };

      // Generate content
      let content: string;
      if (category === "stocks" && env.OPENROUTER_API_KEY) {
        content = await generateWeeklyContentOpenRouter(env.OPENROUTER_API_KEY, summary);
      } else if (env.AI) {
        content = await generateWeeklyContentWorkersAI(env.AI, summary);
      } else {
        content = generateFallbackWeeklyContent(summary);
      }

      // Generate title and slug
      const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1);
      const title = `${categoryTitle} Weekly Recap: ${weekStart} - ${dominantBias} Week`;
      const slug = `${category}-weekly-${weekStart}`;

      // Save to D1
      await env.DB.prepare(
        `INSERT INTO blog_posts (signal_id, slug, title, content, category, published_at)
         VALUES (NULL, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(slug) DO UPDATE SET
           title = excluded.title,
           content = excluded.content,
           published_at = datetime('now')`
      ).bind(slug, title, content, category).run();

      console.log(`[WeeklyBlog] Generated: ${title} (${slug})`);
    } catch (error) {
      console.error(`[WeeklyBlog] Error generating ${category} summary:`, error);
    }
  }
}
