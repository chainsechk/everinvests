import { describe, it, expect, vi } from "vitest";
import { getLatestSignal, getSignalHistory } from "../../src/lib/db/client";

describe("getLatestSignal", () => {
  it("returns null when no rows", async () => {
    const mockDb = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn().mockResolvedValue(null),
        })),
      })),
    } as any;

    const result = await getLatestSignal(mockDb, "crypto");
    expect(result).toBeNull();
    expect(mockDb.prepare).toHaveBeenCalled();
  });
});

describe("getSignalHistory", () => {
  it("returns empty array when no rows", async () => {
    const mockDb = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          all: vi.fn().mockResolvedValue({ results: [] }),
        })),
      })),
    } as any;

    const result = await getSignalHistory(mockDb, "crypto", 7);
    expect(result).toEqual([]);
  });
});
