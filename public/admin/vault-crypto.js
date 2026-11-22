/**
 * OpenCreche Privacy Vault — pure WebCrypto helpers (`public/admin/vault-crypto.js`)
 *
 * Byte-for-byte compatible with `scripts/vault-cli.mjs` (Node `crypto`) and with the
 * client-side decryptor in `src/components/vault/PrivacyVaultRuntime.astro`:
 *
 *   - JSON manifest envelope:
 *       { "version": 1, "alg": "AES-256-GCM", "iv": <12-byte IV, base64>,
 *         "ciphertext": <ciphertext + 16-byte GCM authTag concatenated, base64> }
 *     WebCrypto's encrypt() output already ends with the authTag, so its result is
 *     exactly what the CLI stores in `combined`.
 *
 *   - Binary media blob (public/vault-media, extension ".enc"):
 *       [12-byte IV][ciphertext][16-byte authTag]
 *
 * The master key is a base64-encoded 32-byte (256-bit) AES key
 * (`VAULT_MASTER_KEY` in `.env` and in the Cloudflare Worker secret).
 *
 * This module is DOM-free so it can also be imported and roundtrip-tested
 * by Node/Bun outside the browser.
 */

/** Decode a base64 string into a fresh Uint8Array. */
export function b64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Encode a Uint8Array into base64 (chunked to avoid call-stack limits). */
export function bytesToB64(bytes) {
  let out = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(out);
}

/**
 * Import a base64 master key as a non-extractable AES-GCM CryptoKey.
 * Throws a descriptive error when the key is not valid base64 or not 32 bytes.
 */
export async function importAesKey(keyB64) {
  let raw;
  try {
    raw = b64ToBytes(String(keyB64).trim());
  } catch (err) {
    throw new Error('The master key is not valid base64 text.');
  }
  if (raw.length !== 32) {
    throw new Error(
      `The master key must decode to 32 bytes (AES-256), received ${raw.length} byte(s).`
    );
  }
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/**
 * Encrypt a UTF-8 JSON object into the CLI-compatible envelope object.
 * Serialize for disk with JSON.stringify(envelope, null, 2) exactly like the CLI.
 */
export async function encryptJson(dataObj, cryptoKey) {
  const plaintext = new TextEncoder().encode(JSON.stringify(dataObj));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ctAndTag = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, plaintext);
  return {
    version: 1,
    alg: 'AES-256-GCM',
    iv: bytesToB64(iv),
    ciphertext: bytesToB64(new Uint8Array(ctAndTag)),
  };
}

/** Decrypt a JSON manifest envelope back into a plain object. */
export async function decryptJson(envelope, cryptoKey) {
  const iv = b64ToBytes(envelope.iv);
  const ciphertext = b64ToBytes(envelope.ciphertext);
  const decryptedBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ciphertext);
  return JSON.parse(new TextDecoder().decode(decryptedBuf));
}

/**
 * Encrypt raw bytes (e.g., EXIF-stripped WebP/SVG image data) into the
 * binary blob layout: [12-byte IV][ciphertext][16-byte authTag].
 */
export async function encryptBinary(bytes, cryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ctAndTag = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, bytes);
  const out = new Uint8Array(12 + ctAndTag.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ctAndTag), 12);
  return out;
}

/** Decrypt a binary blob ([IV][ciphertext+authTag]) back into raw bytes. */
export async function decryptBinary(bytes, cryptoKey) {
  const iv = bytes.slice(0, 12);
  const ciphertext = bytes.slice(12);
  const decryptedBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ciphertext);
  return new Uint8Array(decryptedBuf);
}

/** Generate a fresh, cryptographically random 32-byte master key (base64). */
export function generateMasterKeyB64() {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  return bytesToB64(raw);
}

/** The public, well-known DEMO key baked into the template (never use in production). */
export const DEMO_MASTER_KEY_B64 = 'T3BlbkNyZWNoZURlbW9WbHV0TWFzdGVyS2V5MjAyNiE=';
