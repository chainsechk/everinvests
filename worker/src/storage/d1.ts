import type { AssetSignal, Bias, Category, MacroSignal } from "../types";
import { formatMacroForStorage } from "../signals";
import type { BenchmarkData } from "../data/twelvedata";

type D1Database = import("@cloudflare/workers-types").D1Database;

// ============================================================
// Benchmark Data (Tier 2 IC - Relative Strength)
// ============================================================

export async function saveBenchmarkData(args: {
  db: D1Database;
  ticker: string;
  date: string;
  price: number;
  ma20: number;
  fetchedAt: string;
}): Promise<void> {
  const { db, ticker, date, price, ma20, fetchedAt } = args;

  await db
    .prepare(
      `INSERT INTO benchmark_data (ticker, date, price, ma20, fetched_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(ticker, date) DO UPDATE SET
         price = excluded.price,
         ma20 = excluded.ma20,
         fetched_at = excluded.fetched_at`
    )
    .bind(ticker, date, price, ma20, fetchedAt)
    .run();
}

export async function getBenchmarkData(args: {
  db: D1Database;
}): Promise<BenchmarkData> {
  const { db } = args;

  // Get latest benchmark data for each ticker
  const { results } = await db
    .prepare(
      `SELECT ticker, price, ma20
       FROM benchmark_data
       WHERE date = (SELECT MAX(date) FROM benchmark_data)
       ORDER BY ticker`
    )
    .all<{ ticker: string; price: number; ma20: number }>();

  const benchmarks: BenchmarkData = { spy: null, xlk: null, xle: null };

  for (const row of results ?? []) {
    const key = row.ticker.toLowerCase() as "spy" | "xlk" | "xle";
    if (key in benchmarks) {
      benchmarks[key] = { price: row.price, ma20: row.ma20 };
    }
  }

  return benchmarks;
}

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
      // Include regime classification in data_json (Phase 1-4)
      regime: signal?.regime ?? null,
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
        JSON.stringify({
          reasoning: asset.reasoning,
          volumeSignal: asset.volumeSignal,
          indicators: asset.indicators,
          confluence: asset.confluence,
        })
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

// ============================================================
// Delta Computation Support
// ============================================================

export interface PreviousSignalForDelta {
  bias: Bias;
  assets: Array<{
    ticker: string;
    price: number;
    bias: Bias;
  }>;
}

export async function getPreviousSignalForDelta(args: {
  db: D1Database;
  category: Category;
  date: string;
  timeSlot: string;
}): Promise<PreviousSignalForDelta | null> {
  const { db, category, date, timeSlot } = args;

  // Get the previous signal for this category
  const prevSignal = await db
    .prepare(
      `SELECT id, bias
       FROM signals
       WHERE category = ?
         AND (date < ? OR (date = ? AND time_slot < ?))
       ORDER BY date DESC, time_slot DESC
       LIMIT 1`
    )
    .bind(category, date, date, timeSlot)
    .first<{ id: number; bias: Bias }>();

  if (!prevSignal) {
    return null;
  }

  // Get asset signals for the previous signal
  const { results: assets } = await db
    .prepare(
      `SELECT ticker, price, bias
       FROM asset_signals
       WHERE signal_id = ?`
    )
    .bind(prevSignal.id)
    .all<{ ticker: string; price: number; bias: Bias }>();

  return {
    bias: prevSignal.bias,
    assets: assets ?? [],
  };
}

// ============================================================
// LLM Provenance Functions
// ============================================================

export interface PromptVersionRecord {
  id: number;
  name: string;
  version: string;
  template: string;
  created_at: string;
}

export async function ensurePromptVersion(args: {
  db: D1Database;
  name: string;
  version: string;
  template: string;
  createdAt: string;
}): Promise<number> {
  const { db, name, version, template, createdAt } = args;

  // Try to get existing prompt version
  const existing = await db
    .prepare("SELECT id FROM prompt_versions WHERE name = ? AND version = ?")
    .bind(name, version)
    .first<{ id: number }>();

  if (existing) {
    return existing.id;
  }

  // Insert new prompt version
  const row = await db
    .prepare(
      `INSERT INTO prompt_versions (name, version, template, created_at)
       VALUES (?, ?, ?, ?)
       RETURNING id`
    )
    .bind(name, version, template, createdAt)
    .first<{ id: number }>();

  return row?.id ?? 0;
}

export async function getPromptVersionId(args: {
  db: D1Database;
  name: string;
  version: string;
}): Promise<number | null> {
  const { db, name, version } = args;

  const row = await db
    .prepare("SELECT id FROM prompt_versions WHERE name = ? AND version = ?")
    .bind(name, version)
    .first<{ id: number }>();

  return row?.id ?? null;
}

export interface LLMRunInput {
  db: D1Database;
  signalId: number | null;
  promptVersionId: number | null;
  model: string;
  tokensIn: number | null;
  tokensOut: number | null;
  latencyMs: number;
  status: "success" | "error" | "fallback";
  errorMsg?: string;
  fallbackReason?: string;
}

export async function saveLLMRun(args: LLMRunInput): Promise<number> {
  const {
    db,
    signalId,
    promptVersionId,
    model,
    tokensIn,
    tokensOut,
    latencyMs,
    status,
    errorMsg,
    fallbackReason,
  } = args;

  try {
    const row = await db
      .prepare(
        `INSERT INTO llm_runs (
          signal_id, prompt_version_id, model, tokens_in, tokens_out,
          latency_ms, status, error_msg, fallback_reason, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        RETURNING id`
      )
      .bind(
        signalId,
        promptVersionId,
        model,
        tokensIn,
        tokensOut,
        latencyMs,
        status,
        errorMsg ?? null,
        fallbackReason ?? null
      )
      .first<{ id: number }>();

    return row?.id ?? 0;
  } catch (e) {
    console.error("Failed to save LLM run:", e);
    return 0;
  }
}
