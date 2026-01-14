import { describe, it, expect } from "vitest";
import { latestSignalSql, historySignalSql, assetSignalsSql } from "../../src/lib/db/queries";

describe("SQL query builders", () => {
  it("latestSignalSql selects latest by category", () => {
    const sql = latestSignalSql();
    expect(sql).toContain("WHERE s.category = ?");
    expect(sql).toContain("ORDER BY s.date DESC, s.time_slot DESC");
    expect(sql).toContain("LIMIT 1");
  });

  it("historySignalSql selects with limit", () => {
    const sql = historySignalSql();
    expect(sql).toContain("WHERE s.category = ?");
    expect(sql).toContain("LIMIT ?");
  });

  it("assetSignalsSql selects by signal_id", () => {
    const sql = assetSignalsSql();
    expect(sql).toContain("WHERE signal_id = ?");
  });
});
