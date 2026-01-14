import { describe, it, expect, vi } from "vitest";

class MockResponse {
  body: string;
  init: ResponseInit;
  constructor(body: string, init: ResponseInit = {}) {
    this.body = body;
    this.init = init;
  }
  static json(data: unknown, init?: ResponseInit) {
    return new MockResponse(JSON.stringify(data), init);
  }
}
vi.stubGlobal("Response", MockResponse);

import { GET } from "../../src/pages/api/history/[category]";

describe("GET /api/history/[category]", () => {
  it("returns 404 for invalid category", async () => {
    const context = {
      params: { category: "metals" },
      request: new Request("https://example.com/api/history/metals"),
      locals: { runtime: { env: {} } },
    } as any;

    const response = await GET(context);
    expect(response.init?.status).toBe(404);
  });

  it("returns 400 for invalid limit", async () => {
    const mockDb = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          all: vi.fn().mockResolvedValue({ results: [] }),
        })),
      })),
    };

    const context = {
      params: { category: "crypto" },
      request: new Request("https://example.com/api/history/crypto?limit=0"),
      locals: { runtime: { env: { DB: mockDb } } },
    } as any;

    const response = await GET(context);
    expect(response.init?.status).toBe(400);
  });

  it("returns 400 for limit exceeding max", async () => {
    const mockDb = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          all: vi.fn().mockResolvedValue({ results: [] }),
        })),
      })),
    };

    const context = {
      params: { category: "crypto" },
      request: new Request("https://example.com/api/history/crypto?limit=100"),
      locals: { runtime: { env: { DB: mockDb } } },
    } as any;

    const response = await GET(context);
    expect(response.init?.status).toBe(400);
  });
});
