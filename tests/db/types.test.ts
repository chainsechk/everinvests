import { describe, it, expect } from "vitest";
import { normalizeCategory, type Category } from "../../src/lib/db/types";

describe("normalizeCategory", () => {
  it("returns valid category for known values", () => {
    expect(normalizeCategory("crypto")).toBe("crypto");
    expect(normalizeCategory("forex")).toBe("forex");
    expect(normalizeCategory("stocks")).toBe("stocks");
  });

  it("returns null for unknown values", () => {
    expect(normalizeCategory("metals")).toBeNull();
    expect(normalizeCategory("")).toBeNull();
  });
});
