import { WalletSdkError, WalletErrorCodes } from "../errors";
import type { KeystorePayload } from "../public/types";

const ITERATIONS = 100000;

function getWebCrypto() {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.subtle) {
    throw new WalletSdkError(WalletErrorCodes.DECRYPT_FAILED, "WebCrypto is not available");
  }
  return cryptoObj;
}

function assertPassword(password: string) {
  if (!password || password.length < 8) {
    throw new WalletSdkError(WalletErrorCodes.INVALID_PASSWORD, "Password must be at least 8 chars");
  }
}

async function deriveAesKey(password: string, salt: Uint8Array) {
  const c = getWebCrypto();
  const encoder = new TextEncoder();
  const keyMaterial = await c.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  return c.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as unknown as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptJson(payload: unknown, password: string): Promise<KeystorePayload> {
  assertPassword(password);
  const c = getWebCrypto();
  const encoder = new TextEncoder();
  const salt = c.getRandomValues(new Uint8Array(16));
  const iv = c.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(password, salt);
  const data = encoder.encode(JSON.stringify(payload));
  const encrypted = await c.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    data as unknown as BufferSource
  );
  return { salt: Array.from(salt), iv: Array.from(iv), ciphertext: Array.from(new Uint8Array(encrypted)) };
}

export async function decryptJson<T>(blob: KeystorePayload, password: string): Promise<T> {
  assertPassword(password);
  try {
    const c = getWebCrypto();
    const decoder = new TextDecoder();
    const key = await deriveAesKey(password, new Uint8Array(blob.salt));
    const plain = await c.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(blob.iv) as unknown as BufferSource },
      key,
      new Uint8Array(blob.ciphertext) as unknown as BufferSource
    );
    return JSON.parse(decoder.decode(plain)) as T;
  } catch {
    throw new WalletSdkError(WalletErrorCodes.DECRYPT_FAILED, "Failed to decrypt keystore");
  }
}
