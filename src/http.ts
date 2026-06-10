import type { ApiErrorBody, Env, ErrorCode } from "./types";

const DEFAULT_CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,X-API-Key-Id,X-API-Key",
  "Access-Control-Max-Age": "86400",
};

export function jsonResponse(
  body: unknown,
  init: ResponseInit = {},
  env?: Env,
): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  applyCors(headers, env);

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

export function errorResponse(
  status: number,
  code: ErrorCode,
  message: string,
  details?: unknown,
  env?: Env,
): Response {
  const body: ApiErrorBody = {
    ok: false,
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  };

  return jsonResponse(body, { status }, env);
}

export function optionsResponse(env: Env): Response {
  const headers = new Headers();
  applyCors(headers, env);
  return new Response(null, { status: 204, headers });
}

export function applyCors(headers: Headers, env?: Env): void {
  headers.set("Access-Control-Allow-Origin", env?.CORS_ORIGIN || "*");
  for (const [key, value] of Object.entries(DEFAULT_CORS_HEADERS)) {
    headers.set(key, value);
  }
}
