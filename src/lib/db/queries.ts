export function latestSignalSql(): string {
  return `
    SELECT s.*, m.overall as macro_overall
    FROM signals s
    LEFT JOIN macro_signals m ON s.macro_id = m.id
    WHERE s.category = ?
    ORDER BY s.date DESC, s.time_slot DESC
    LIMIT 1
  `;
}

export function historySignalSql(): string {
  return `
    SELECT s.*, m.overall as macro_overall
    FROM signals s
    LEFT JOIN macro_signals m ON s.macro_id = m.id
    WHERE s.category = ?
    ORDER BY s.date DESC, s.time_slot DESC
    LIMIT ?
  `;
}

export function assetSignalsSql(): string {
  return `
    SELECT *
    FROM asset_signals
    WHERE signal_id = ?
    ORDER BY ticker ASC
  `;
}

export function latestMacroSql(): string {
  return `
    SELECT *
    FROM macro_signals
    ORDER BY date DESC, time_slot DESC
    LIMIT 1
  `;
}
