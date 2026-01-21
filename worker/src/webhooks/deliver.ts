// Webhook delivery system for external integrations
import type { Env } from "../env";
import type { Category, Bias, AssetSignal, MacroSignal } from "../types";

interface Webhook {
  id: number;
  url: string;
  secret: string | null;
  categories: string;
  active: number;
}

interface WebhookPayload {
  event: "signal.created";
  timestamp: string;
  data: {
    category: Category;
    date: string;
    timeSlot: string;
    bias: Bias;
    summary: string;
    macro: {
      overall: string;
      dxyBias: string;
      vixLevel: string;
    };
    assets: Array<{
      ticker: string;
      bias: Bias;
      price: number;
      vsMA20: string;
    }>;
    signalUrl: string;
  };
}

// Create HMAC-SHA256 signature for webhook payload
async function createSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Deliver webhook to a single endpoint
async function deliverToWebhook(
  webhook: Webhook,
  payload: WebhookPayload,
  env: Env
): Promise<{ success: boolean; statusCode?: number; error?: string; responseTime: number }> {
  const startTime = Date.now();
  const payloadStr = JSON.stringify(payload);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "EverInvests-Webhook/1.0",
      "X-EverInvests-Event": payload.event,
      "X-EverInvests-Timestamp": payload.timestamp,
    };

    // Add signature if secret is configured
    if (webhook.secret) {
      const signature = await createSignature(payloadStr, webhook.secret);
      headers["X-EverInvests-Signature"] = `sha256=${signature}`;
    }

    const response = await fetch(webhook.url, {
      method: "POST",
      headers,
      body: payloadStr,
    });

    const responseTime = Date.now() - startTime;

    return {
      success: response.ok,
      statusCode: response.status,
      responseTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      responseTime: Date.now() - startTime,
    };
  }
}

// Log webhook delivery result
async function logWebhookDelivery(
  env: Env,
  webhookId: number,
  signalId: number,
  result: { success: boolean; statusCode?: number; error?: string; responseTime: number }
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO webhook_logs (webhook_id, signal_id, status_code, response_time_ms, error)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(
        webhookId,
        signalId,
        result.statusCode ?? null,
        result.responseTime,
        result.error ?? null
      )
      .run();

    // Update webhook last_triggered_at and failure_count
    if (result.success) {
      await env.DB.prepare(
        `UPDATE webhooks SET last_triggered_at = datetime('now'), failure_count = 0 WHERE id = ?`
      )
        .bind(webhookId)
        .run();
    } else {
      await env.DB.prepare(
        `UPDATE webhooks SET failure_count = failure_count + 1 WHERE id = ?`
      )
        .bind(webhookId)
        .run();

      // Disable webhook after 10 consecutive failures
      await env.DB.prepare(
        `UPDATE webhooks SET active = 0 WHERE id = ? AND failure_count >= 10`
      )
        .bind(webhookId)
        .run();
    }
  } catch (e) {
    console.error("[Webhook] Failed to log delivery:", e);
  }
}

// Main function to deliver webhooks for a signal
export async function deliverWebhooks(
  env: Env,
  signalId: number,
  category: Category,
  date: string,
  timeSlot: string,
  bias: Bias,
  summary: string,
  macro: MacroSignal,
  assets: AssetSignal[]
): Promise<void> {
  // Fetch active webhooks for this category
  const result = await env.DB.prepare(
    `SELECT id, url, secret, categories, active
     FROM webhooks
     WHERE active = 1 AND categories LIKE ?`
  )
    .bind(`%${category}%`)
    .all<Webhook>();

  const webhooks = result.results || [];

  if (webhooks.length === 0) {
    return;
  }

  console.log(`[Webhook] Delivering to ${webhooks.length} webhooks for ${category}`);

  const siteUrl = env.SITE_URL || "https://everinvests.com";
  const payload: WebhookPayload = {
    event: "signal.created",
    timestamp: new Date().toISOString(),
    data: {
      category,
      date,
      timeSlot,
      bias,
      summary,
      macro: {
        overall: macro.overall,
        dxyBias: macro.dxyBias,
        vixLevel: macro.vixLevel,
      },
      assets: assets.slice(0, 10).map((a) => ({
        ticker: a.ticker,
        bias: a.bias,
        price: a.price,
        vsMA20: a.vsMA20,
      })),
      signalUrl: `${siteUrl}/${category}/${date}/${timeSlot}`,
    },
  };

  // Deliver to all webhooks in parallel (fire-and-forget style but log results)
  await Promise.all(
    webhooks.map(async (webhook) => {
      const result = await deliverToWebhook(webhook, payload, env);
      await logWebhookDelivery(env, webhook.id, signalId, result);
    })
  );
}
