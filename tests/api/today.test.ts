import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Response globally
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

import { GET } from "../../src/pages/api/today/[category]";

describe("GET /api/today/[category]", () => {
  it("returns 404 for invalid category", async () => {
    const context = {
      params: { category: "metals" },
      locals: { runtime: { env: {} } },
    } as any;

    const response = await GET(context);
    expect(response.init?.status).toBe(404);
  });

  it("returns 500 when DB not configured", async () => {
    const context = {
      params: { category: "crypto" },
      locals: { runtime: { env: {} } },
    } as any;

    const response = await GET(context);
    expect(response.init?.status).toBe(500);
  });
});
