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

export function signalByDateTimeSql(): string {
  return `
    SELECT s.*, m.overall as macro_overall
    FROM signals s
    LEFT JOIN macro_signals m ON s.macro_id = m.id
    WHERE s.category = ? AND s.date = ? AND s.time_slot = ?
    LIMIT 1
  `;
}

export function adjacentSignalsSql(): string {
  return `
    SELECT id, date, time_slot, bias
    FROM signals
    WHERE category = ?
      AND (date < ? OR (date = ? AND time_slot < ?))
    ORDER BY date DESC, time_slot DESC
    LIMIT 1
  `;
}

export function nextSignalSql(): string {
  return `
    SELECT id, date, time_slot, bias
    FROM signals
    WHERE category = ?
      AND (date > ? OR (date = ? AND time_slot > ?))
    ORDER BY date ASC, time_slot ASC
    LIMIT 1
  `;
}

export function assetHistorySql(): string {
  return `
    SELECT a.*, s.date, s.time_slot, s.bias as signal_bias
    FROM asset_signals a
    JOIN signals s ON a.signal_id = s.id
    WHERE s.category = ? AND a.ticker = ?
    ORDER BY s.date DESC, s.time_slot DESC
    LIMIT ?
  `;
}

export function distinctTickersSql(): string {
  return `
    SELECT DISTINCT a.ticker
    FROM asset_signals a
    JOIN signals s ON a.signal_id = s.id
    WHERE s.category = ?
    ORDER BY a.ticker ASC
  `;
}

export function recentSignalPagesSql(): string {
  return `
    SELECT category, date, time_slot
    FROM signals
    ORDER BY date DESC, time_slot DESC
    LIMIT ?
  `;
}

export function relatedSignalsSql(): string {
  return `
    SELECT category, bias, date, time_slot
    FROM signals
    WHERE date = ? AND time_slot = ?
    ORDER BY category
  `;
}
