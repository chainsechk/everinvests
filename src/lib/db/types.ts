export const categories = ["crypto", "forex", "stocks"] as const;
export type Category = (typeof categories)[number];

export function normalizeCategory(value: string): Category | null {
  return categories.includes(value as Category) ? (value as Category) : null;
}

export interface MacroSignalRow {
  id: number;
  date: string;
  time_slot: string;
  generated_at: string;
  dxy_bias: string | null;
  vix_level: string | null;
  yields_bias: string | null;
  overall: string | null;
  data_json: string | null;
}

export interface SignalRow {
  id: number;
  category: Category;
  date: string;
  time_slot: string;
  generated_at: string;
  bias: string;
  macro_id: number | null;
  data_json: string | null;
  output_json: string | null;
}

export interface AssetSignalRow {
  id: number;
  signal_id: number;
  ticker: string;
  bias: string | null;
  price: number | null;
  vs_20d_ma: string | null;
  secondary_ind: string | null;
  data_json: string | null;
}

export interface RunLogRow {
  id: number;
  category: string | null;
  time_slot: string | null;
  run_at: string;
  status: string;
  duration_ms: number | null;
  error_msg: string | null;
}
