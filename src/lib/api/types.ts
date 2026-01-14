// src/lib/api/types.ts
import type { Category } from "../db/types";

export interface AssetResponse {
  id: number;
  signal_id: number;
  ticker: string;
  bias: string | null;
  price: number | null;
  vs_20d_ma: string | null;
  secondary_ind: string | null;
  data: unknown | null;
}

export interface SignalResponse {
  signal: {
    id: number;
    category: Category;
    date: string;
    time_slot: string;
    generated_at: string;
    bias: string;
    macro_id: number | null;
    macro_overall: string | null;
    data: unknown | null;
    output: unknown | null;
  };
  assets: AssetResponse[];
  macro: string | null;
}

export interface HistoryResponse {
  category: Category;
  count: number;
  items: Array<{
    id: number;
    category: Category;
    date: string;
    time_slot: string;
    generated_at: string;
    bias: string;
    macro_overall: string | null;
    data: unknown | null;
    output: unknown | null;
  }>;
}

export interface MacroResponse {
  id: number;
  date: string;
  time_slot: string;
  generated_at: string;
  dxy_bias: string | null;
  vix_level: string | null;
  yields_bias: string | null;
  overall: string | null;
  data: unknown | null;
}

export interface ErrorResponse {
  error: string;
  [key: string]: unknown;
}
