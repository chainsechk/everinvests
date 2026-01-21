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

// GET /api/webhooks - List all webhooks (public, no secrets exposed)
export async function GET(context: APIContext) {
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

// POST /api/webhooks - Register a new webhook
export async function POST(context: APIContext) {
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

    // Only allow HTTPS URLs in production
    if (!url.startsWith("https://") && !url.includes("localhost")) {
      return Response.json({ error: "URL must use HTTPS" }, { status: 400 });
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
