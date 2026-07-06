import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

describe("POST /api/broker/manage", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
  });

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = originalNodeEnv;
  });

  it("returns a non-fatal response when broker management is unavailable outside local development", async () => {
    const { POST } = await import("../broker/manage/route");
    const req = new NextRequest("http://localhost/api/broker/manage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe("warn");
    expect(body.message).toContain("local development");
  });
});
