export type Env = {
  BOT_IDS?: string;
  API_KEY_IDS?: string;
  ENABLE_TELEGRAM_PROXY?: string;
  TELEGRAM_API_BASE?: string;
  TELEGRAM_TIMEOUT_MS?: string;
  CORS_ORIGIN?: string;
  PACKAGE_VERSION?: string;
  [key: string]: string | undefined;
};

export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "CONFIGURATION_ERROR"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "TELEGRAM_ERROR"
  | "UPSTREAM_ERROR";

export type ApiErrorBody = {
  ok: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
};

export type AuthResult =
  | { ok: true; keyId: string }
  | { ok: false; response: Response };

export type RouteMatch =
  | { kind: "health" }
  | { kind: "version" }
  | { kind: "send"; botId: string; method: string }
  | { kind: "sendDynamic"; botId: string }
  | { kind: "proxy"; botId: string; method: string }
  | { kind: "notFound" };
