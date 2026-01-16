import type { AssetSignal, Bias, Category, MacroSignal } from "../types";
import { formatMacroForStorage } from "../signals";

type D1Database = import("@cloudflare/workers-types").D1Database;

export async function saveMacroSignal(args: {
  db: D1Database;
  date: string;
  timeSlot: string;
  signal: MacroSignal | null;
  rawData: unknown;
  fallbackReason?: string;
}): Promise<number> {
  const { db, date, timeSlot, signal, rawData, fallbackReason } = args;

  const isFallback = !signal || signal.overall === "Unavailable";

  const formatted = signal && !isFallback ? formatMacroForStorage(signal) : null;

  const stored = {
    dxy_bias: formatted?.dxy_bias ?? null,
    vix_level: formatted?.vix_level ?? null,
    yields_bias: formatted?.yields_bias ?? null,
    overall: formatted?.overall ?? "Unavailable",
    data_json: JSON.stringify({
      ...(typeof rawData === "object" && rawData !== null ? rawData : { raw: rawData }),
      fallback: isFallback,
      fallback_reason: fallbackReason ?? null,
    }),
  };

  const row = await db
    .prepare(
      `INSERT INTO macro_signals (date, time_slot, generated_at, dxy_bias, vix_level, yields_bias, overall, data_json)
       VALUES (?, ?, datetime('now'), ?, ?, ?, ?, ?)
       ON CONFLICT(date, time_slot) DO UPDATE SET
         generated_at = datetime('now'),
         dxy_bias = excluded.dxy_bias,
         vix_level = excluded.vix_level,
         yields_bias = excluded.yields_bias,
         overall = excluded.overall,
         data_json = excluded.data_json
       RETURNING id`
    )
    .bind(
      date,
      timeSlot,
      stored.dxy_bias,
      stored.vix_level,
      stored.yields_bias,
      stored.overall,
      stored.data_json
    )
    .first<{ id: number }>();

  return row?.id ?? 0;
}

export async function saveSignal(args: {
  db: D1Database;
  category: Category;
  date: string;
  timeSlot: string;
  bias: Bias;
  macroId: number | null;
  rawData: unknown;
  output: unknown;
}): Promise<number> {
  const { db, category, date, timeSlot, bias, macroId, rawData, output } = args;

  const row = await db
    .prepare(
      `INSERT INTO signals (category, date, time_slot, generated_at, bias, macro_id, data_json, output_json)
       VALUES (?, ?, ?, datetime('now'), ?, ?, ?, ?)
       ON CONFLICT(category, date, time_slot) DO UPDATE SET
         generated_at = datetime('now'),
         bias = excluded.bias,
         macro_id = excluded.macro_id,
         data_json = excluded.data_json,
         output_json = excluded.output_json
       RETURNING id`
    )
    .bind(
      category,
      date,
      timeSlot,
      bias,
      macroId,
      JSON.stringify(rawData),
      JSON.stringify(output)
    )
    .first<{ id: number }>();

  return row?.id ?? 0;
}

export async function saveAssetSignals(args: {
  db: D1Database;
  signalId: number;
  assets: AssetSignal[];
}): Promise<void> {
  const { db, signalId, assets } = args;

  await db.prepare("DELETE FROM asset_signals WHERE signal_id = ?").bind(signalId).run();

  for (const asset of assets) {
    await db
      .prepare(
        `INSERT INTO asset_signals (signal_id, ticker, bias, price, vs_20d_ma, secondary_ind, data_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        signalId,
        asset.ticker,
        asset.bias,
        asset.price,
        asset.vsMA20,
        asset.secondaryInd,
        JSON.stringify({ reasoning: asset.reasoning })
      )
      .run();
  }
}

export async function logRun(args: {
  db: D1Database;
  category: string;
  timeSlot: string;
  status: "success" | "error";
  durationMs: number;
  errorMsg?: string;
}): Promise<void> {
  const { db, category, timeSlot, status, durationMs, errorMsg } = args;

  try {
    await db
      .prepare(
        `INSERT INTO run_logs (category, time_slot, run_at, status, duration_ms, error_msg)
         VALUES (?, ?, datetime('now'), ?, ?, ?)`
      )
      .bind(category, timeSlot, status, durationMs, errorMsg ?? null)
      .run();
  } catch (e) {
    console.error("Failed to log run:", e);
  }
}
