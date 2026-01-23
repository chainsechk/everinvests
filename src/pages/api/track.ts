// src/pages/api/track.ts
// Server-side event tracking endpoint
import type { APIContext } from "astro";

interface TrackEvent {
  event: string;
  category?: string;
  source?: string;
  meta?: Record<string, unknown>;
}

function anonymizeIp(ip: string | null): string | null {
  if (!ip || ip === "unknown") return null;

  // IPv6
  if (ip.includes(":")) {
    const parts = ip.split(":").filter(Boolean);
    if (parts.length === 0) return null;
    return `${parts.slice(0, 3).join(":")}::`;
  }

  // IPv4
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.*.*`;
  }

  return null;
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
  const ipPrefix = anonymizeIp(ip);
  const pagePath =
    typeof meta?.path === "string" ? meta.path :
    typeof meta?.page_path === "string" ? meta.page_path :
    null;

  // If DB is available, store analytics event (best-effort; never block user)
  if (db) {
    try {
      await db
        .prepare(
          `INSERT INTO analytics_events (event, category, source, page_path, referer, user_agent, ip_prefix, meta_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        )
        .bind(
          event,
          category || null,
          source || null,
          pagePath,
          referer,
          userAgent,
          ipPrefix,
          meta ? JSON.stringify(meta) : null
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
