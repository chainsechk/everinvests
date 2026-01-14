import type { APIContext } from "astro";
import { normalizeCategory } from "../../../lib/db/types";
import { getSignalHistory } from "../../../lib/db/client";

const DEFAULT_LIMIT = 7;
const MAX_LIMIT = 30;

export async function GET(context: APIContext) {
  const { category: rawCategory } = context.params;
  const category = normalizeCategory(rawCategory ?? "");

  if (!category) {
    return Response.json(
      { error: "unknown category", valid: ["crypto", "forex", "stocks"] },
      { status: 404 }
    );
  }

  const db = context.locals.runtime?.env?.DB;
  if (!db) {
    return Response.json(
      { error: "database not configured" },
      { status: 500 }
    );
  }

  const url = new URL(context.request.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : DEFAULT_LIMIT;

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return Response.json(
      { error: "invalid limit", min: 1, max: MAX_LIMIT },
      { status: 400 }
    );
  }

  const signals = await getSignalHistory(db, category, limit);

  return Response.json({
    category,
    count: signals.length,
    items: signals.map((s) => ({
      ...s,
      data: s.data_json ? JSON.parse(s.data_json) : null,
      output: s.output_json ? JSON.parse(s.output_json) : null,
    })),
  });
}
