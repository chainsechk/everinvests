// src/pages/api/track.ts
// Server-side event tracking endpoint
import type { APIContext } from "astro";

interface TrackEvent {
  event: string;
  category?: string;
  source?: string;
  meta?: Record<string, unknown>;
}

export async function POST(context: APIContext) {
  const db = context.locals.runtime?.env?.DB;

  // Parse request body
  let body: TrackEvent;
  try {
    body = await context.request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const { event, category, source, meta } = body;

  if (!event) {
    return Response.json({ error: "event is required" }, { status: 400 });
  }

  // Validate event type
  const validEvents = [
    "cta_click",
    "vip_cta_click",
    "telegram_cta_click",
    "share_click",
    "widget_view",
    "page_view",
  ];

  if (!validEvents.includes(event)) {
    return Response.json({ error: "invalid event type" }, { status: 400 });
  }

  // Get request metadata
  const userAgent = context.request.headers.get("user-agent") || "unknown";
  const referer = context.request.headers.get("referer") || "direct";
  const ip = context.request.headers.get("cf-connecting-ip") || "unknown";

  // If DB is available, log to run_logs table with 'analytics' category
  if (db) {
    try {
      await db
        .prepare(
          `INSERT INTO run_logs (category, status, message, data_json, created_at)
           VALUES (?, ?, ?, ?, datetime('now'))`
        )
        .bind(
          "analytics",
          "info",
          `${event}: ${category || "unknown"}`,
          JSON.stringify({
            event,
            category: category || null,
            source: source || null,
            meta: meta || null,
            userAgent,
            referer,
            // Don't store full IP for privacy
            ipPrefix: ip.split(".").slice(0, 2).join(".") + ".*.*",
          })
        )
        .run();
    } catch (err) {
      console.error("Failed to log event:", err);
      // Don't fail the request if logging fails
    }
  }

  // Always log to console for Cloudflare logs
  console.log(`[Track] ${event}`, { category, source, referer });

  return Response.json({ success: true, event });
}

// Block GET requests
export async function GET() {
  return Response.json({ error: "method not allowed" }, { status: 405 });
}
