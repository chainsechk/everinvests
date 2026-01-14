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

import { GET } from "../../src/pages/api/macro";

describe("GET /api/macro", () => {
  it("returns 500 when DB not configured", async () => {
    const context = {
      locals: { runtime: { env: {} } },
    } as any;

    const response = await GET(context);
    expect(response.init?.status).toBe(500);
  });

  it("returns 404 when no macro signal", async () => {
    const mockDb = {
      prepare: vi.fn(() => ({
        first: vi.fn().mockResolvedValue(null),
      })),
    };

    const context = {
      locals: { runtime: { env: { DB: mockDb } } },
    } as any;

    const response = await GET(context);
    expect(response.init?.status).toBe(404);
  });
});
