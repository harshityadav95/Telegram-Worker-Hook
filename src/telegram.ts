import { isEnabled, telegramApiBase, telegramTimeoutMs } from "./config";
import { applyCors, errorResponse } from "./http";
import type { Env } from "./types";

const CURATED_METHODS = new Set(["sendMessage", "sendPhoto", "sendDocument", "sendMediaGroup"]);
const METHOD_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;

type JsonRecord = Record<string, unknown>;

export async function forwardCuratedSend(
  request: Request,
  env: Env,
  token: string,
  method: string,
): Promise<Response> {
  if (request.method !== "POST") {
    return errorResponse(405, "METHOD_NOT_ALLOWED", "Use POST for Telegram send endpoints", undefined, env);
  }

  if (!CURATED_METHODS.has(method)) {
    return errorResponse(404, "NOT_FOUND", "Unsupported send method", undefined, env);
  }

  const normalized = await normalizeTelegramBody(request, env, method);
  if (normalized instanceof Response) {
    return normalized;
  }

  return callTelegram(env, token, method, normalized.body, normalized.headers);
}

export async function forwardDynamicSend(request: Request, env: Env, token: string): Promise<Response> {
  if (request.method !== "POST") {
    return errorResponse(405, "METHOD_NOT_ALLOWED", "Use POST for Telegram send endpoints", undefined, env);
  }

  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return errorResponse(415, "UNSUPPORTED_MEDIA_TYPE", "The /send endpoint requires an application/json body", undefined, env);
  }

  const parsed = await readJsonRecord(request, env);
  if (parsed instanceof Response) {
    return parsed;
  }

  const method = typeof parsed.method === "string" ? parsed.method : "";
  if (!CURATED_METHODS.has(method)) {
    return errorResponse(400, "BAD_REQUEST", "Body method must be one of sendMessage, sendPhoto, sendDocument, sendMediaGroup", undefined, env);
  }

  const payload = { ...parsed };
  delete payload.method;
  const validation = validatePayload(method, payload, env);
  if (validation instanceof Response) {
    return validation;
  }

  return callTelegram(env, token, method, JSON.stringify(payload), {
    "content-type": "application/json; charset=utf-8",
  });
}

export async function forwardProxy(request: Request, env: Env, token: string, method: string): Promise<Response> {
  if (request.method !== "POST") {
    return errorResponse(405, "METHOD_NOT_ALLOWED", "Use POST for Telegram proxy endpoints", undefined, env);
  }

  if (!isEnabled(env.ENABLE_TELEGRAM_PROXY)) {
    return errorResponse(403, "FORBIDDEN", "Telegram proxy is disabled", undefined, env);
  }

  if (!METHOD_PATTERN.test(method)) {
    return errorResponse(400, "BAD_REQUEST", "Invalid Telegram method", undefined, env);
  }

  const normalized = await normalizeTelegramBody(request, env);
  if (normalized instanceof Response) {
    return normalized;
  }

  return callTelegram(env, token, method, normalized.body, normalized.headers);
}

type NormalizedBody = {
  body: BodyInit;
  headers: HeadersInit;
};

async function normalizeTelegramBody(request: Request, env: Env, method?: string): Promise<NormalizedBody | Response> {
  const contentType = request.headers.get("content-type") || "";
  const lowerContentType = contentType.toLowerCase();

  if (lowerContentType.includes("application/json")) {
    const parsed = await readJsonRecord(request, env);
    if (parsed instanceof Response) {
      return parsed;
    }

    if (method) {
      const validation = validatePayload(method, parsed, env);
      if (validation instanceof Response) {
        return validation;
      }
    }

    return {
      body: JSON.stringify(parsed),
      headers: { "content-type": "application/json; charset=utf-8" },
    };
  }

  if (lowerContentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    if (method) {
      const validation = validateFormDataPayload(method, formData, env);
      if (validation instanceof Response) {
        return validation;
      }
    }

    return { body: formData, headers: {} };
  }

  if (lowerContentType.includes("application/x-www-form-urlencoded")) {
    const body = await request.text();
    if (method) {
      const formData = new URLSearchParams(body);
      const validation = validateSearchParamsPayload(method, formData, env);
      if (validation instanceof Response) {
        return validation;
      }
    }

    return {
      body,
      headers: { "content-type": "application/x-www-form-urlencoded" },
    };
  }

  return errorResponse(
    415,
    "UNSUPPORTED_MEDIA_TYPE",
    "Use application/json, multipart/form-data, or application/x-www-form-urlencoded",
    undefined,
    env,
  );
}

async function readJsonRecord(request: Request, env: Env): Promise<JsonRecord | Response> {
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return errorResponse(400, "BAD_REQUEST", "Request body must be a JSON object", undefined, env);
    }

    return parsed as JsonRecord;
  } catch {
    return errorResponse(400, "BAD_REQUEST", "Request body must be valid JSON", undefined, env);
  }
}

function validatePayload(method: string, payload: JsonRecord, env: Env): Response | undefined {
  if (!hasValue(payload.chat_id)) {
    return errorResponse(400, "BAD_REQUEST", "chat_id is required", undefined, env);
  }

  if (method === "sendMessage" && !hasValue(payload.text)) {
    return errorResponse(400, "BAD_REQUEST", "text is required for sendMessage", undefined, env);
  }

  if (method === "sendPhoto" && !hasValue(payload.photo)) {
    return errorResponse(400, "BAD_REQUEST", "photo is required for sendPhoto", undefined, env);
  }

  if (method === "sendDocument" && !hasValue(payload.document)) {
    return errorResponse(400, "BAD_REQUEST", "document is required for sendDocument", undefined, env);
  }

  if (method === "sendMediaGroup" && !hasValue(payload.media)) {
    return errorResponse(400, "BAD_REQUEST", "media is required for sendMediaGroup", undefined, env);
  }

  return undefined;
}

function validateFormDataPayload(method: string, formData: FormData, env: Env): Response | undefined {
  return validatePresence(method, (key) => formData.has(key), env);
}

function validateSearchParamsPayload(method: string, params: URLSearchParams, env: Env): Response | undefined {
  return validatePresence(method, (key) => params.has(key), env);
}

function validatePresence(method: string, has: (key: string) => boolean, env: Env): Response | undefined {
  if (!has("chat_id")) {
    return errorResponse(400, "BAD_REQUEST", "chat_id is required", undefined, env);
  }

  const requiredFieldByMethod: Record<string, string> = {
    sendMessage: "text",
    sendPhoto: "photo",
    sendDocument: "document",
    sendMediaGroup: "media",
  };
  const requiredField = requiredFieldByMethod[method];
  if (requiredField && !has(requiredField)) {
    return errorResponse(400, "BAD_REQUEST", `${requiredField} is required for ${method}`, undefined, env);
  }

  return undefined;
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

async function callTelegram(
  env: Env,
  token: string,
  method: string,
  body: BodyInit,
  headers: HeadersInit,
): Promise<Response> {
  const url = `${telegramApiBase(env)}/bot${token}/${method}`;
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), telegramTimeoutMs(env));

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers,
      body,
      signal: abortController.signal,
    });

    const responseHeaders = new Headers();
    responseHeaders.set("content-type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    applyCors(responseHeaders, env);

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch {
    return errorResponse(502, "UPSTREAM_ERROR", "Telegram API request failed", undefined, env);
  } finally {
    clearTimeout(timeout);
  }
}
