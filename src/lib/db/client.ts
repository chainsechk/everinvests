import type { Category, SignalRow, AssetSignalRow, MacroSignalRow } from "./types";
import { latestSignalSql, historySignalSql, assetSignalsSql, latestMacroSql } from "./queries";

type D1Database = import("@cloudflare/workers-types").D1Database;

export interface SignalWithMacro extends SignalRow {
  macro_overall: string | null;
}

export async function getLatestSignal(
  db: D1Database,
  category: Category
): Promise<SignalWithMacro | null> {
  const row = await db
    .prepare(latestSignalSql())
    .bind(category)
    .first<SignalWithMacro>();
  return row ?? null;
}

export async function getSignalHistory(
  db: D1Database,
  category: Category,
  limit: number
): Promise<SignalWithMacro[]> {
  const { results } = await db
    .prepare(historySignalSql())
    .bind(category, limit)
    .all<SignalWithMacro>();
  return results ?? [];
}

export async function getAssetSignals(
  db: D1Database,
  signalId: number
): Promise<AssetSignalRow[]> {
  const { results } = await db
    .prepare(assetSignalsSql())
    .bind(signalId)
    .all<AssetSignalRow>();
  return results ?? [];
}

export async function getLatestMacro(
  db: D1Database
): Promise<MacroSignalRow | null> {
  const row = await db.prepare(latestMacroSql()).first<MacroSignalRow>();
  return row ?? null;
}
