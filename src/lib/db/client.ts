import type { Category, SignalRow, AssetSignalRow, MacroSignalRow } from "./types";
import {
  latestSignalSql,
  historySignalSql,
  assetSignalsSql,
  latestMacroSql,
  signalByDateTimeSql,
  adjacentSignalsSql,
  nextSignalSql,
  assetHistorySql,
  distinctTickersSql,
  recentSignalPagesSql,
  relatedSignalsSql,
  latestSignalWithAssetsSql,
} from "./queries";

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

export async function getLatestSignalWithAssets(
  db: D1Database,
  category: Category
): Promise<SignalWithMacro | null> {
  const row = await db
    .prepare(latestSignalWithAssetsSql())
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

export async function getSignalByDateTime(
  db: D1Database,
  category: Category,
  date: string,
  timeSlot: string
): Promise<SignalWithMacro | null> {
  const row = await db
    .prepare(signalByDateTimeSql())
    .bind(category, date, timeSlot)
    .first<SignalWithMacro>();
  return row ?? null;
}

export interface AdjacentSignal {
  id: number;
  date: string;
  time_slot: string;
  bias: string;
}

export async function getPreviousSignal(
  db: D1Database,
  category: Category,
  date: string,
  timeSlot: string
): Promise<AdjacentSignal | null> {
  const row = await db
    .prepare(adjacentSignalsSql())
    .bind(category, date, date, timeSlot)
    .first<AdjacentSignal>();
  return row ?? null;
}

export async function getNextSignal(
  db: D1Database,
  category: Category,
  date: string,
  timeSlot: string
): Promise<AdjacentSignal | null> {
  const row = await db
    .prepare(nextSignalSql())
    .bind(category, date, date, timeSlot)
    .first<AdjacentSignal>();
  return row ?? null;
}

export interface AssetHistoryRow extends AssetSignalRow {
  date: string;
  time_slot: string;
  signal_bias: string;
}

export async function getAssetHistory(
  db: D1Database,
  category: Category,
  ticker: string,
  limit: number
): Promise<AssetHistoryRow[]> {
  const { results } = await db
    .prepare(assetHistorySql())
    .bind(category, ticker, limit)
    .all<AssetHistoryRow>();
  return results ?? [];
}

export async function getDistinctTickers(
  db: D1Database,
  category: Category
): Promise<string[]> {
  const { results } = await db
    .prepare(distinctTickersSql())
    .bind(category)
    .all<{ ticker: string }>();
  return results?.map((r) => r.ticker) ?? [];
}

export interface SignalPageRef {
  category: Category;
  date: string;
  time_slot: string;
}

export async function getRecentSignalPages(
  db: D1Database,
  limit: number
): Promise<SignalPageRef[]> {
  const { results } = await db
    .prepare(recentSignalPagesSql())
    .bind(limit)
    .all<SignalPageRef>();
  return results ?? [];
}

export interface RelatedSignal {
  category: Category;
  bias: string;
  date: string;
  time_slot: string;
}

export async function getRelatedSignals(
  db: D1Database,
  date: string,
  timeSlot: string
): Promise<RelatedSignal[]> {
  const { results } = await db
    .prepare(relatedSignalsSql())
    .bind(date, timeSlot)
    .all<RelatedSignal>();
  return results ?? [];
}
