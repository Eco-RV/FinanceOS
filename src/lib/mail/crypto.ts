import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** AES-256-GCM con la clave `MAIL_TOKEN_KEY` (32 bytes en base64). */
function key(): Buffer {
  const raw = process.env.MAIL_TOKEN_KEY;
  const buf = raw ? Buffer.from(raw, "base64") : null;
  if (!buf || buf.length !== 32) {
    throw new Error(
      "MAIL_TOKEN_KEY debe ser 32 bytes en base64 (openssl rand -base64 32)",
    );
  }
  return buf;
}

/** Devuelve "iv.tag.cifrado" en base64. */
export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function decryptToken(payload: string): string {
  const [iv, tag, enc] = payload.split(".").map((p) => Buffer.from(p, "base64"));
  if (!iv || !tag || !enc) throw new Error("Token cifrado inválido");
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
