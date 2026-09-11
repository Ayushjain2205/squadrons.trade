import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { hostRoot } from "../db.js";

const ALGO = "aes-256-gcm";
const KEY_FILE = path.join(hostRoot, "data", ".plugin-secrets-key");

let cachedKey: Buffer | null = null;

function resolveKeyMaterial(): string {
  const fromEnv = process.env.SQUADRONS_PLUGIN_SECRETS_KEY?.trim();
  if (fromEnv) return fromEnv;

  fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true });
  if (fs.existsSync(KEY_FILE)) {
    return fs.readFileSync(KEY_FILE, "utf8").trim();
  }
  const generated = randomBytes(32).toString("hex");
  fs.writeFileSync(KEY_FILE, generated, { mode: 0o600 });
  return generated;
}

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  cachedKey = scryptSync(resolveKeyMaterial(), "squadrons-agent-plugins", 32);
  return cachedKey;
}

/** Encrypt a secrets map for SQLite storage. */
export function encryptSecrets(secrets: Record<string, string>): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const plaintext = JSON.stringify(secrets);
  const enc = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

/** Decrypt secrets; returns {} on empty/missing. */
export function decryptSecrets(blob: string | null | undefined): Record<string, string> {
  if (!blob) return {};
  const [version, ivB64, tagB64, dataB64] = blob.split(":");
  if (version !== "v1" || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Corrupt plugin secrets blob");
  }
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
  const parsed = JSON.parse(plaintext) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string" && value.length > 0) {
      out[key] = value;
    }
  }
  return out;
}

/** Merge patch into existing secrets. Empty string deletes a key. */
export function mergeSecrets(
  existing: Record<string, string>,
  patch: Record<string, string> | undefined,
): Record<string, string> {
  if (!patch) return { ...existing };
  const next = { ...existing };
  for (const [key, value] of Object.entries(patch)) {
    if (value === "") {
      delete next[key];
    } else if (typeof value === "string") {
      next[key] = value;
    }
  }
  return next;
}
