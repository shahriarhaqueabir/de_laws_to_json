import { describe, it, expect } from "vitest";
import { sanitizeErrorMessage } from "../sanitize";

describe("sanitizeErrorMessage", () => {
  it("passes through clean error messages unchanged", () => {
    const msg = "Rate limit exceeded. Try again in 30 seconds.";
    expect(sanitizeErrorMessage(new Error(msg))).toBe(msg);
  });

  it("passes through generic network errors unchanged", () => {
    const msg = "fetch failed";
    expect(sanitizeErrorMessage(new Error(msg))).toBe(msg);
  });

  it("passes through auth errors with no key pattern", () => {
    const msg = "Incorrect API key provided";
    expect(sanitizeErrorMessage(new Error(msg))).toBe(msg);
  });

  it("redacts OpenAI-style keys (sk-proj-...)", () => {
    const msg =
      "401 Invalid authentication: sk-proj-AbCdEfGhIjKlMnOpQrStUvWxYz1234567890. Retry.";
    expect(sanitizeErrorMessage(new Error(msg))).toBe(
      "Cloud AI call failed. Check your API key and provider settings.",
    );
  });

  it("redacts Anthropic-style keys (sk-ant-...)", () => {
    const msg =
      "Authentication error: sk-ant-AbCdEfGhIjKlMnOpQrStUvWxYz1234567890";
    expect(sanitizeErrorMessage(new Error(msg))).toBe(
      "Cloud AI call failed. Check your API key and provider settings.",
    );
  });

  it("redacts bearer tokens in error messages", () => {
    const msg =
      "Authorization: Bearer sk-proj-abcdefghijklmnopqrstuvwxyz123456";
    expect(sanitizeErrorMessage(new Error(msg))).toBe(
      "Cloud AI call failed. Check your API key and provider settings.",
    );
  });

  it("redacts API key patterns in Authorization headers", () => {
    const msg =
      "Response status 401. Authorization: Bearer sk-proj-test-key-1234567890abcdef";
    expect(sanitizeErrorMessage(new Error(msg))).toBe(
      "Cloud AI call failed. Check your API key and provider settings.",
    );
  });

  it("handles non-Error throws gracefully", () => {
    expect(sanitizeErrorMessage("just a string")).toBe("just a string");
  });

  it("handles null/undefined errors gracefully", () => {
    expect(sanitizeErrorMessage(null)).toBe("null");
    expect(sanitizeErrorMessage(undefined)).toBe("undefined");
  });

  it("redacts query params containing api_key", () => {
    const msg =
      "Request failed: https://api.example.com/v1/chat?api_key=sk-proj-abcdef123456";
    expect(sanitizeErrorMessage(new Error(msg))).toBe(
      "Cloud AI call failed. Check your API key and provider settings.",
    );
  });
});
