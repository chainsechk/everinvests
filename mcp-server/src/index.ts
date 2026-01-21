// mcp-server/src/index.ts
// EverInvests MCP Server - Exposes market signals to AI agents
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Types for our D1 data
interface SignalRow {
  id: number;
  category: string;
  date: string;
  time_slot: string;
  bias: string;
  data_json: string | null;
  output_json: string | null;
}

interface AssetSignalRow {
  ticker: string;
  bias: string | null;
  price: number | null;
  vs_20d_ma: string | null;
  data_json: string | null;
}

interface MacroRow {
  overall: string;
  dxy_bias: string;
  vix_level: string;
  data_json: string | null;
}

interface AccuracyRow {
  predicted_bias: string;
  total: number;
  correct: number;
}

// Environment bindings
export interface Env {
  DB: D1Database;
  MCP_AGENT: DurableObjectNamespace;
  SITE_URL: string;
}

// MCP Agent implementation
export class EverInvestsMCP extends McpAgent<Env, {}, {}> {
  server = new McpServer({
    name: "EverInvests",
    version: "1.0.0",
  });

  async init() {
    // Tool: Get latest signal for a category
    this.server.tool(
      "get_signal",
      "Get the latest market signal for crypto, forex, or stocks. Returns bias (Bullish/Bearish/Neutral), summary, and individual asset breakdowns.",
      {
        category: z.enum(["crypto", "forex", "stocks"]).describe("Market category to get signal for"),
      },
      async ({ category }) => {
        const signal = await this.env.DB.prepare(
          `SELECT s.id, s.category, s.date, s.time_slot, s.bias, s.data_json, s.output_json
           FROM signals s
           WHERE s.category = ?
           ORDER BY s.date DESC, s.time_slot DESC
           LIMIT 1`
        ).bind(category).first<SignalRow>();

        if (!signal) {
          return {
            content: [{ type: "text", text: `No signal available for ${category}` }],
          };
        }

        // Get asset signals
        const assets = await this.env.DB.prepare(
          `SELECT ticker, bias, price, vs_20d_ma, data_json
           FROM asset_signals
           WHERE signal_id = ?`
        ).bind(signal.id).all<AssetSignalRow>();

        const assetList = (assets.results || []).map(a => {
          const assetData = a.data_json ? JSON.parse(a.data_json) : {};

          // Use structured indicators if available, else parse reasoning
          let trendSignal = "?";
          let momentumSignal = "?";
          let strengthSignal = "?";

          if (assetData.indicators) {
            trendSignal = assetData.indicators.trend || "?";
            momentumSignal = assetData.indicators.momentum || "?";
            strengthSignal = assetData.indicators.strength || "?";
          } else if (assetData.reasoning) {
            // Try new format: "Trend: bullish, Momentum: neutral, Strength: bearish"
            const trendMatch = assetData.reasoning.match(/Trend:\s*(\w+)/);
            const momentumMatch = assetData.reasoning.match(/Momentum:\s*(\w+)/);
            const strengthMatch = assetData.reasoning.match(/Strength:\s*(\w+)/);
            if (trendMatch) trendSignal = trendMatch[1];
            if (momentumMatch) momentumSignal = momentumMatch[1];
            if (strengthMatch) strengthSignal = strengthMatch[1];
          }

          const confluence = assetData.confluence || `${[trendSignal, momentumSignal, strengthSignal].filter(s => s === "bullish").length}/3`;

          return `  - ${a.ticker}: ${a.bias} [T:${trendSignal[0].toUpperCase()} M:${momentumSignal[0].toUpperCase()} S:${strengthSignal[0].toUpperCase()}] (${confluence}) $${a.price?.toLocaleString() || "N/A"}`;
        }).join("\n");

        const output = signal.output_json ? JSON.parse(signal.output_json) : {};

        return {
          content: [{
            type: "text",
            text: `# ${category.toUpperCase()} Signal - ${signal.date} ${signal.time_slot} UTC

**Bias:** ${signal.bias}

**Summary:** ${output.summary || "No summary available"}

**Assets:**
${assetList || "No asset data"}

**Link:** ${this.env.SITE_URL}/${category}/${signal.date}/${signal.time_slot}`,
          }],
        };
      }
    );

    // Tool: Get macro context
    this.server.tool(
      "get_macro",
      "Get current macro market context including DXY (dollar index) bias, VIX level, and overall risk sentiment.",
      {},
      async () => {
        const macro = await this.env.DB.prepare(
          `SELECT overall, dxy_bias, vix_level, data_json
           FROM macro_signals
           ORDER BY date DESC, time_slot DESC
           LIMIT 1`
        ).first<MacroRow>();

        if (!macro) {
          return {
            content: [{ type: "text", text: "No macro data available" }],
          };
        }

        const data = macro.data_json ? JSON.parse(macro.data_json) : {};

        return {
          content: [{
            type: "text",
            text: `# Macro Context

**Overall Sentiment:** ${macro.overall}

**Dollar (DXY):** ${macro.dxy_bias}${data.dxy ? ` (${data.dxy.toFixed(2)})` : ""}

**VIX Level:** ${macro.vix_level}${data.vix ? ` (${data.vix.toFixed(1)})` : ""}

${data.fearGreed ? `**Fear & Greed Index:** ${data.fearGreed}/100` : ""}
${data.btcDominance ? `**BTC Dominance:** ${data.btcDominance.toFixed(1)}%` : ""}
${data.yieldSpread ? `**2Y-10Y Spread:** ${data.yieldSpread.toFixed(2)}%` : ""}`,
          }],
        };
      }
    );

    // Tool: Get signal history
    this.server.tool(
      "get_history",
      "Get recent signal history for a category. Shows past signals with their bias and whether they were correct.",
      {
        category: z.enum(["crypto", "forex", "stocks"]).describe("Market category"),
        days: z.number().min(1).max(30).default(7).describe("Number of days of history (1-30, default 7)"),
      },
      async ({ category, days }) => {
        const signals = await this.env.DB.prepare(
          `SELECT s.date, s.time_slot, s.bias, s.summary,
                  o.correct, o.price_change_pct
           FROM signals s
           LEFT JOIN signal_outcomes o ON s.id = o.signal_id
           WHERE s.category = ?
           ORDER BY s.date DESC, s.time_slot DESC
           LIMIT ?`
        ).bind(category, days * 3).all<{
          date: string;
          time_slot: string;
          bias: string;
          summary: string;
          correct: number | null;
          price_change_pct: number | null;
        }>();

        if (!signals.results?.length) {
          return {
            content: [{ type: "text", text: `No history available for ${category}` }],
          };
        }

        const history = signals.results.map(s => {
          const outcome = s.correct !== null
            ? (s.correct ? "✓" : "✗") + ` (${s.price_change_pct?.toFixed(1)}%)`
            : "pending";
          return `- ${s.date} ${s.time_slot}: ${s.bias} → ${outcome}`;
        }).join("\n");

        return {
          content: [{
            type: "text",
            text: `# ${category.toUpperCase()} Signal History (Last ${days} Days)

${history}`,
          }],
        };
      }
    );

    // Tool: Get accuracy stats
    this.server.tool(
      "get_accuracy",
      "Get signal accuracy statistics for a category over the last 30 days, broken down by bias type.",
      {
        category: z.enum(["crypto", "forex", "stocks"]).describe("Market category"),
      },
      async ({ category }) => {
        const stats = await this.env.DB.prepare(
          `SELECT predicted_bias, COUNT(*) as total, SUM(correct) as correct
           FROM signal_outcomes
           WHERE category = ? AND checked_at >= date('now', '-30 days')
           GROUP BY predicted_bias`
        ).bind(category).all<AccuracyRow>();

        if (!stats.results?.length) {
          return {
            content: [{ type: "text", text: `No accuracy data available for ${category}` }],
          };
        }

        let totalAll = 0;
        let correctAll = 0;
        const breakdown = stats.results.map(s => {
          totalAll += s.total;
          correctAll += s.correct;
          const rate = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
          return `- ${s.predicted_bias}: ${rate}% (${s.correct}/${s.total})`;
        }).join("\n");

        const overallRate = totalAll > 0 ? Math.round((correctAll / totalAll) * 100) : 0;

        return {
          content: [{
            type: "text",
            text: `# ${category.toUpperCase()} Accuracy (30 Days)

**Overall:** ${overallRate}% (${correctAll}/${totalAll})

**By Bias:**
${breakdown}

**Performance Page:** ${this.env.SITE_URL}/performance`,
          }],
        };
      }
    );

    // Resource: List available categories
    this.server.resource(
      "categories",
      "mcp://everinvests/categories",
      async () => ({
        contents: [{
          uri: "mcp://everinvests/categories",
          text: JSON.stringify({
            categories: ["crypto", "forex", "stocks"],
            description: "Available market categories for signals",
            updateSchedule: {
              crypto: ["00:00", "08:00", "16:00"],
              forex: ["00:00", "08:00", "14:00"],
              stocks: ["17:00", "21:00"],
            },
          }, null, 2),
        }],
      })
    );
  }
}

// Worker entry point
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/health") {
      return Response.json({ status: "ok", service: "everinvests-mcp" });
    }

    // MCP endpoint
    if (url.pathname === "/mcp" || url.pathname === "/sse") {
      // Get or create the MCP agent instance
      const id = env.MCP_AGENT.idFromName("main");
      const agent = env.MCP_AGENT.get(id);
      return agent.fetch(request);
    }

    // API info
    if (url.pathname === "/") {
      return Response.json({
        name: "EverInvests MCP Server",
        version: "1.0.0",
        description: "Model Context Protocol server for EverInvests market signals",
        endpoints: {
          mcp: "/mcp",
          health: "/health",
        },
        tools: [
          { name: "get_signal", description: "Get latest market signal for a category" },
          { name: "get_macro", description: "Get current macro market context" },
          { name: "get_history", description: "Get recent signal history" },
          { name: "get_accuracy", description: "Get signal accuracy statistics" },
        ],
        resources: [
          { name: "categories", description: "List available market categories" },
        ],
        website: env.SITE_URL,
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};
