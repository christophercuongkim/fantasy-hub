import crypto from "node:crypto";

// AES-256-GCM at rest. Wire format: base64( iv[12] || ciphertext || tag[16] ).
// This layout is exactly what Python's cryptography AESGCM expects (nonce, then
// ciphertext-with-tag), so the api service decrypts these blobs unchanged.
const IV_LEN = 12;
const TAG_LEN = 16;

function key(): Buffer {
  const b64 = process.env.TOKEN_ENC_KEY;
  if (!b64) throw new Error("TOKEN_ENC_KEY is not set");
  const k = Buffer.from(b64, "base64");
  if (k.length !== 32) {
    throw new Error("TOKEN_ENC_KEY must be 32 bytes base64-encoded");
  }
  return k;
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ct, tag]).toString("base64");
}

export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const ct = buf.subarray(IV_LEN, buf.length - TAG_LEN);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString(
    "utf8",
  );
}
