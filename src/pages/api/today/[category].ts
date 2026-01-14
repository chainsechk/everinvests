import type { APIContext } from "astro";
import { normalizeCategory } from "../../../lib/db/types";
import { getLatestSignal, getAssetSignals } from "../../../lib/db/client";

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

  const signal = await getLatestSignal(db, category);
  if (!signal) {
    return Response.json(
      { error: "no signal available", category },
      { status: 404 }
    );
  }

  const assets = await getAssetSignals(db, signal.id);

  return Response.json({
    signal: {
      ...signal,
      data: signal.data_json ? JSON.parse(signal.data_json) : null,
      output: signal.output_json ? JSON.parse(signal.output_json) : null,
    },
    assets: assets.map((a) => ({
      ...a,
      data: a.data_json ? JSON.parse(a.data_json) : null,
    })),
    macro: signal.macro_overall,
  });
}
