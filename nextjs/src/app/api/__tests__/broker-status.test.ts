/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

// broker/status uses globalThis.__brokerPid — no Supabase mocks needed

declare global {
  var __brokerPid: number | null;
}

describe("GET /api/broker/status", () => {
  beforeEach(() => {
    globalThis.__brokerPid = null;
  });

  afterEach(() => {
    globalThis.__brokerPid = null;
  });

  it("returns 200 with running: false when no PID is set", async () => {
    const { GET } = await import("../broker/status/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ running: false, pid: null });
  });

  it("returns running: true for an active PID", async () => {
    globalThis.__brokerPid = process.pid;

    const { GET } = await import("../broker/status/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.running).toBe(true);
    expect(body.pid).toBe(process.pid);
  });

  it("returns running: false for a dead PID and cleans up stale PID", async () => {
    globalThis.__brokerPid = 999_999_999;

    const { GET } = await import("../broker/status/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.running).toBe(false);
    expect(body.pid).toBeNull();
    expect(globalThis.__brokerPid).toBeNull();
  });

  it("returns expected JSON structure with boolean and nullable fields", async () => {
    const { GET } = await import("../broker/status/route");
    const res = await GET();
    const body = await res.json();

    expect(body).toHaveProperty("running");
    expect(body).toHaveProperty("pid");
    expect(typeof body.running).toBe("boolean");
  });
});
