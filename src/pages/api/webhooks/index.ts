// src/pages/api/webhooks/index.ts
import type { APIContext } from "astro";

interface WebhookRow {
  id: number;
  url: string;
  categories: string;
  active: number;
  created_at: string;
  last_triggered_at: string | null;
  failure_count: number;
}

// Validate API key for webhook management
function validateApiKey(context: APIContext): boolean {
  const apiKey = context.locals.runtime?.env?.WEBHOOK_API_KEY;
  if (!apiKey) return false; // Webhooks disabled if no key configured

  const authHeader = context.request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;

  const providedKey = authHeader.slice(7);
  return providedKey === apiKey;
}

// Block internal/private IPs to prevent SSRF
function isInternalUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    const hostname = url.hostname.toLowerCase();

    // Block localhost variants
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return true;
    }

    // Block private IP ranges
    const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipMatch) {
      const [, a, b] = ipMatch.map(Number);
      // 10.x.x.x, 172.16-31.x.x, 192.168.x.x, 169.254.x.x
      if (a === 10) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 169 && b === 254) return true;
      if (a === 0) return true;
    }

    // Block internal hostnames
    if (hostname.endsWith(".local") || hostname.endsWith(".internal")) {
      return true;
    }

    return false;
  } catch {
    return true; // Block on parse error
  }
}

// GET /api/webhooks - List webhooks (requires API key)
export async function GET(context: APIContext) {
  if (!validateApiKey(context)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = context.locals.runtime?.env?.DB;
  if (!db) {
    return Response.json({ error: "Database not configured" }, { status: 500 });
  }

  try {
    const result = await db.prepare(
      `SELECT id, url, categories, active, created_at, last_triggered_at, failure_count
       FROM webhooks
       ORDER BY created_at DESC
       LIMIT 100`
    ).all<WebhookRow>();

    return Response.json({
      webhooks: (result.results || []).map((w) => ({
        id: w.id,
        url: w.url,
        categories: w.categories.split(","),
        active: w.active === 1,
        createdAt: w.created_at,
        lastTriggeredAt: w.last_triggered_at,
        failureCount: w.failure_count,
      })),
    });
  } catch (e) {
    return Response.json({ error: "Failed to fetch webhooks" }, { status: 500 });
  }
}

// POST /api/webhooks - Register a new webhook (requires API key)
export async function POST(context: APIContext) {
  if (!validateApiKey(context)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = context.locals.runtime?.env?.DB;
  if (!db) {
    return Response.json({ error: "Database not configured" }, { status: 500 });
  }

  try {
    const body = await context.request.json();
    const { url, secret, categories } = body as {
      url?: string;
      secret?: string;
      categories?: string[];
    };

    // Validate URL
    if (!url || typeof url !== "string") {
      return Response.json({ error: "url is required" }, { status: 400 });
    }

    try {
      new URL(url);
    } catch {
      return Response.json({ error: "Invalid URL format" }, { status: 400 });
    }

    // Only allow HTTPS URLs
    if (!url.startsWith("https://")) {
      return Response.json({ error: "URL must use HTTPS" }, { status: 400 });
    }

    // Block internal/private IPs (SSRF protection)
    if (isInternalUrl(url)) {
      return Response.json({ error: "Internal URLs are not allowed" }, { status: 400 });
    }

    // Validate categories
    const validCategories = ["crypto", "forex", "stocks"];
    const selectedCategories = categories?.filter((c) => validCategories.includes(c)) || validCategories;
    const categoriesStr = selectedCategories.join(",");

    // Insert webhook
    const result = await db.prepare(
      `INSERT INTO webhooks (url, secret, categories) VALUES (?, ?, ?)`
    )
      .bind(url, secret || null, categoriesStr)
      .run();

    return Response.json({
      success: true,
      webhook: {
        id: result.meta.last_row_id,
        url,
        categories: selectedCategories,
        active: true,
      },
    }, { status: 201 });
  } catch (e) {
    console.error("Webhook registration error:", e);
    return Response.json({ error: "Failed to register webhook" }, { status: 500 });
  }
}
