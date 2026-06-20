const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12; // 96 bits — recommended for GCM

interface EncryptedPayload {
  iv: string;
  ciphertext: string;
}

function getRawKey(): Uint8Array {
  const hex = process.env.SERVER_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "SERVER_ENCRYPTION_KEY is not set. Provide a 64-character hex string (32 bytes for AES-256).",
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      `SERVER_ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes). Got "${hex.length}" characters.`,
    );
  }
  return Buffer.from(hex, "hex");
}

async function importKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, { name: ALGORITHM }, false, [
    "encrypt",
    "decrypt",
  ]);
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function fromBase64(encoded: string): Uint8Array {
  return Buffer.from(encoded, "base64");
}

function generateIv(): Uint8Array {
  const iv = new Uint8Array(IV_LENGTH);
  crypto.getRandomValues(iv);
  return iv;
}

/**
 * Encrypt a plaintext API key string using AES-256-GCM.
 *
 * Returns a JSON string of the form `{ "iv": "<base64>", "ciphertext": "<base64>" }`.
 */
export async function encryptApiKey(plaintext: string): Promise<string> {
  const raw = getRawKey();
  const key = await importKey(raw);
  const iv = generateIv();
  const encoded = new TextEncoder().encode(plaintext);

  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoded,
  );

  const payload: EncryptedPayload = {
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encrypted)),
  };

  return JSON.stringify(payload);
}

/**
 * Decrypt a payload produced by `encryptApiKey` back to the original plaintext.
 *
 * Accepts a JSON string of the form `{ "iv": "<base64>", "ciphertext": "<base64>" }`.
 */
export async function decryptApiKey(encrypted: string): Promise<string> {
  let payload: EncryptedPayload;
  try {
    payload = JSON.parse(encrypted);
  } catch {
    throw new Error("Invalid encrypted payload: not valid JSON.");
  }

  if (
    typeof payload.iv !== "string" ||
    typeof payload.ciphertext !== "string"
  ) {
    throw new Error(
      "Invalid encrypted payload: expected both 'iv' and 'ciphertext' fields as strings.",
    );
  }

  const raw = getRawKey();
  const key = await importKey(raw);
  const iv = fromBase64(payload.iv);
  const ciphertext = fromBase64(payload.ciphertext);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(decrypted);
}
