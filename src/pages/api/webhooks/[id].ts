// src/pages/api/webhooks/[id].ts
import type { APIContext } from "astro";

// Validate API key for webhook management
function validateApiKey(context: APIContext): boolean {
  const apiKey = context.locals.runtime?.env?.WEBHOOK_API_KEY;
  if (!apiKey) return false;

  const authHeader = context.request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;

  return authHeader.slice(7) === apiKey;
}

// DELETE /api/webhooks/:id - Remove a webhook (requires API key)
export async function DELETE(context: APIContext) {
  if (!validateApiKey(context)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = context.locals.runtime?.env?.DB;
  const { id } = context.params;

  if (!db) {
    return Response.json({ error: "Database not configured" }, { status: 500 });
  }

  const webhookId = parseInt(id || "", 10);
  if (isNaN(webhookId)) {
    return Response.json({ error: "Invalid webhook ID" }, { status: 400 });
  }

  try {
    const result = await db.prepare(
      `DELETE FROM webhooks WHERE id = ?`
    ).bind(webhookId).run();

    if (result.meta.changes === 0) {
      return Response.json({ error: "Webhook not found" }, { status: 404 });
    }

    return Response.json({ success: true, deleted: webhookId });
  } catch (e) {
    return Response.json({ error: "Failed to delete webhook" }, { status: 500 });
  }
}

// PATCH /api/webhooks/:id - Update webhook (requires API key)
export async function PATCH(context: APIContext) {
  if (!validateApiKey(context)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = context.locals.runtime?.env?.DB;
  const { id } = context.params;

  if (!db) {
    return Response.json({ error: "Database not configured" }, { status: 500 });
  }

  const webhookId = parseInt(id || "", 10);
  if (isNaN(webhookId)) {
    return Response.json({ error: "Invalid webhook ID" }, { status: 400 });
  }

  try {
    const body = await context.request.json();
    const { active } = body as { active?: boolean };

    if (typeof active !== "boolean") {
      return Response.json({ error: "active must be a boolean" }, { status: 400 });
    }

    const result = await db.prepare(
      `UPDATE webhooks SET active = ?, failure_count = 0 WHERE id = ?`
    ).bind(active ? 1 : 0, webhookId).run();

    if (result.meta.changes === 0) {
      return Response.json({ error: "Webhook not found" }, { status: 404 });
    }

    return Response.json({ success: true, id: webhookId, active });
  } catch (e) {
    return Response.json({ error: "Failed to update webhook" }, { status: 500 });
  }
}
