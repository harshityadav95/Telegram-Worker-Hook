import { errorResponse } from "./http";
import type { Env } from "./types";

const IDENTIFIER_PATTERN = /^[A-Z0-9_]+$/;

export function normalizeIdentifier(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  return IDENTIFIER_PATTERN.test(normalized) ? normalized : null;
}

export function parseIdentifierList(value: string | undefined): Set<string> {
  if (!value) {
    return new Set();
  }

  return new Set(
    value
      .split(",")
      .map((item) => normalizeIdentifier(item))
      .filter((item): item is string => item !== null),
  );
}

export function isEnabled(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes((value || "").trim().toLowerCase());
}

export function resolveBotToken(botId: string, env: Env): string | Response {
  const normalizedBotId = normalizeIdentifier(botId);
  if (!normalizedBotId) {
    return errorResponse(400, "BAD_REQUEST", "Invalid bot id", undefined, env);
  }

  const allowedBotIds = parseIdentifierList(env.BOT_IDS);
  if (allowedBotIds.size === 0) {
    return errorResponse(500, "CONFIGURATION_ERROR", "BOT_IDS is not configured", undefined, env);
  }

  if (!allowedBotIds.has(normalizedBotId)) {
    return errorResponse(404, "NOT_FOUND", "Unknown bot id", undefined, env);
  }

  const secretName = `TELEGRAM_BOT_${normalizedBotId}_TOKEN`;
  const token = env[secretName];
  if (!token) {
    return errorResponse(500, "CONFIGURATION_ERROR", `Missing bot token secret ${secretName}`, undefined, env);
  }

  return token;
}

export function telegramApiBase(env: Env): string {
  return (env.TELEGRAM_API_BASE || "https://api.telegram.org").replace(/\/+$/, "");
}

export function telegramTimeoutMs(env: Env): number {
  const parsed = Number.parseInt(env.TELEGRAM_TIMEOUT_MS || "", 10);
  if (Number.isFinite(parsed) && parsed >= 1000 && parsed <= 30000) {
    return parsed;
  }

  return 10000;
}
