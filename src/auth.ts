import { normalizeIdentifier, parseIdentifierList } from "./config";
import { errorResponse } from "./http";
import type { AuthResult, Env } from "./types";

const textEncoder = new TextEncoder();

export async function authenticate(request: Request, env: Env): Promise<AuthResult> {
  const keyIdHeader = request.headers.get("X-API-Key-Id");
  const apiKeyHeader = request.headers.get("X-API-Key");

  if (!keyIdHeader || !apiKeyHeader) {
    return { ok: false, response: errorResponse(401, "UNAUTHORIZED", "Missing API key headers", undefined, env) };
  }

  const keyId = normalizeIdentifier(keyIdHeader);
  if (!keyId) {
    return { ok: false, response: errorResponse(401, "UNAUTHORIZED", "Invalid API key id", undefined, env) };
  }

  const allowedKeyIds = parseIdentifierList(env.API_KEY_IDS);
  if (allowedKeyIds.size === 0) {
    return { ok: false, response: errorResponse(500, "CONFIGURATION_ERROR", "API_KEY_IDS is not configured", undefined, env) };
  }

  if (!allowedKeyIds.has(keyId)) {
    return { ok: false, response: errorResponse(401, "UNAUTHORIZED", "Unknown API key id", undefined, env) };
  }

  const secretName = `API_KEY_${keyId}`;
  const expectedKey = env[secretName];
  if (!expectedKey) {
    return { ok: false, response: errorResponse(500, "CONFIGURATION_ERROR", `Missing API key secret ${secretName}`, undefined, env) };
  }

  const matches = await secureCompare(apiKeyHeader, expectedKey);
  if (!matches) {
    return { ok: false, response: errorResponse(401, "UNAUTHORIZED", "Invalid API key", undefined, env) };
  }

  return { ok: true, keyId };
}

async function secureCompare(actual: string, expected: string): Promise<boolean> {
  const [actualDigest, expectedDigest] = await Promise.all([sha256(actual), sha256(expected)]);
  let difference = 0;

  for (let index = 0; index < actualDigest.length; index += 1) {
    difference |= (actualDigest[index] ?? 0) ^ (expectedDigest[index] ?? 0);
  }

  return difference === 0;
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", textEncoder.encode(value)));
}
