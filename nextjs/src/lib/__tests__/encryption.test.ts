// @vitest-environment node

import { describe, it, expect, beforeEach } from "vitest";
import { encryptApiKey, decryptApiKey } from "../encryption";

const VALID_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

beforeEach(() => {
  process.env.SERVER_ENCRYPTION_KEY = VALID_KEY;
});

describe("encryptApiKey / decryptApiKey", () => {
  it("encrypts and decrypts a short API key", async () => {
    const original = "sk-abc123";
    const encrypted = await encryptApiKey(original);
    const decrypted = await decryptApiKey(encrypted);
    expect(decrypted).toBe(original);
  });

  it("encrypts and decrypts a long API key", async () => {
    const original =
      "sk-proj-ABCDEF0123456789abcdefghijklmnopqrstuvwxyz0123456789";
    const encrypted = await encryptApiKey(original);
    const decrypted = await decryptApiKey(encrypted);
    expect(decrypted).toBe(original);
  });

  it("produces different ciphertexts for the same plaintext (random IV)", async () => {
    const plaintext = "sk-test-key";
    const a = await encryptApiKey(plaintext);
    const b = await encryptApiKey(plaintext);
    expect(a).not.toBe(b);
  });

  it("produces a valid JSON blob with iv and ciphertext fields", async () => {
    const encrypted = await encryptApiKey("test");
    const parsed = JSON.parse(encrypted);
    expect(parsed).toHaveProperty("iv");
    expect(parsed).toHaveProperty("ciphertext");
    expect(typeof parsed.iv).toBe("string");
    expect(typeof parsed.ciphertext).toBe("string");
    expect(parsed.iv.length).toBeGreaterThan(0);
    expect(parsed.ciphertext.length).toBeGreaterThan(0);
  });
});

describe("decryptApiKey validation", () => {
  it("throws on malformed JSON", async () => {
    await expect(decryptApiKey("not-json")).rejects.toThrow(
      "Invalid encrypted payload: not valid JSON",
    );
  });

  it("throws on missing fields", async () => {
    await expect(decryptApiKey(JSON.stringify({ iv: "aaa" }))).rejects.toThrow(
      "Invalid encrypted payload: expected both 'iv' and 'ciphertext'",
    );
  });

  it("throws on wrong key", async () => {
    const encrypted = await encryptApiKey("secret");
    process.env.SERVER_ENCRYPTION_KEY =
      "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
    await expect(decryptApiKey(encrypted)).rejects.toThrow();
  });
});

describe("key validation", () => {
  it("throws when SERVER_ENCRYPTION_KEY is not set", async () => {
    delete process.env.SERVER_ENCRYPTION_KEY;
    await expect(encryptApiKey("test")).rejects.toThrow(
      "SERVER_ENCRYPTION_KEY is not set",
    );
  });

  it("throws when key is wrong length", async () => {
    process.env.SERVER_ENCRYPTION_KEY = "too-short";
    await expect(encryptApiKey("test")).rejects.toThrow(
      "must be exactly 64 hexadecimal characters",
    );
  });

  it("throws when key contains non-hex characters", async () => {
    process.env.SERVER_ENCRYPTION_KEY = "z".repeat(64);
    await expect(encryptApiKey("test")).rejects.toThrow(
      "must be exactly 64 hexadecimal characters",
    );
  });
});
