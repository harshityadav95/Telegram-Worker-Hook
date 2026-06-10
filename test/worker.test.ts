import { describe, expect, it, vi, afterEach } from "vitest";
import { isEnabled, parseIdentifierList, telegramApiBase, telegramTimeoutMs } from "../src/config";
import worker from "../src/index";
import type { Env } from "../src/types";

const baseEnv: Env = {
  BOT_IDS: "alerts,ops",
  API_KEY_IDS: "internal,monitoring",
  ENABLE_TELEGRAM_PROXY: "false",
  TELEGRAM_API_BASE: "https://telegram.test",
  TELEGRAM_BOT_ALERTS_TOKEN: "111:alerts-token",
  TELEGRAM_BOT_OPS_TOKEN: "222:ops-token",
  API_KEY_INTERNAL: "internal-secret",
  API_KEY_MONITORING: "monitoring-secret",
};

function request(path: string, init: RequestInit = {}): Request {
  const headers = new Headers();
  if (!(init.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }
  headers.set("X-API-Key-Id", "internal");
  headers.set("X-API-Key", "internal-secret");

  new Headers(init.headers).forEach((value, key) => {
    if (value === "undefined") {
      headers.delete(key);
      return;
    }
    headers.set(key, value);
  });

  return new Request(`https://worker.test${path}`, {
    ...init,
    headers,
  });
}

async function json(response: Response): Promise<unknown> {
  return response.json();
}

function mockTelegramFetch(status = 200): ReturnType<typeof vi.fn<typeof fetch>> {
  const fetchMock = vi.fn<typeof fetch>(async () => {
    return new Response(JSON.stringify({ ok: status >= 200 && status < 300, result: { message_id: 42 } }), {
      status,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("telegram worker", () => {
  it("handles CORS preflight", async () => {
    const response = await worker.fetch(
      new Request("https://worker.test/v1/bots/alerts/sendMessage", {
        method: "OPTIONS",
      }),
      { ...baseEnv, CORS_ORIGIN: "https://app.example" },
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example");
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("X-API-Key");
  });

  it("returns health without authentication", async () => {
    const response = await worker.fetch(new Request("https://worker.test/health"), baseEnv);

    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ ok: true, service: "telegram-worker-hook" });
  });

  it("returns version without authentication", async () => {
    const response = await worker.fetch(new Request("https://worker.test/version"), {
      ...baseEnv,
      PACKAGE_VERSION: "1.2.3-test",
    });

    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ ok: true, version: "1.2.3-test" });
  });

  it("returns not found for unknown routes", async () => {
    const response = await worker.fetch(new Request("https://worker.test/missing"), baseEnv);

    expect(response.status).toBe(404);
    expect(await json(response)).toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("rejects missing API key headers", async () => {
    const response = await worker.fetch(
      new Request("https://worker.test/v1/bots/alerts/sendMessage", {
        method: "POST",
        body: JSON.stringify({ chat_id: "-1001", text: "hello" }),
      }),
      baseEnv,
    );

    expect(response.status).toBe(401);
    expect(await json(response)).toMatchObject({
      ok: false,
      error: { code: "UNAUTHORIZED" },
    });
  });

  it("rejects invalid API key ids", async () => {
    const response = await worker.fetch(
      request("/v1/bots/alerts/sendMessage", {
        method: "POST",
        headers: { "X-API-Key-Id": "bad-id!" },
        body: JSON.stringify({ chat_id: "-1001", text: "hello" }),
      }),
      baseEnv,
    );

    expect(response.status).toBe(401);
    expect(await json(response)).toMatchObject({ error: { message: "Invalid API key id" } });
  });

  it("rejects unknown API key ids", async () => {
    const response = await worker.fetch(
      request("/v1/bots/alerts/sendMessage", {
        method: "POST",
        headers: { "X-API-Key-Id": "external" },
        body: JSON.stringify({ chat_id: "-1001", text: "hello" }),
      }),
      baseEnv,
    );

    expect(response.status).toBe(401);
    expect(await json(response)).toMatchObject({ error: { message: "Unknown API key id" } });
  });

  it("rejects invalid API key values", async () => {
    const response = await worker.fetch(
      request("/v1/bots/alerts/sendMessage", {
        method: "POST",
        headers: { "X-API-Key": "wrong-secret" },
        body: JSON.stringify({ chat_id: "-1001", text: "hello" }),
      }),
      baseEnv,
    );

    expect(response.status).toBe(401);
    expect(await json(response)).toMatchObject({ error: { message: "Invalid API key" } });
  });

  it("reports missing API key configuration", async () => {
    const env: Env = { ...baseEnv };
    delete env.API_KEY_IDS;

    const response = await worker.fetch(
      request("/v1/bots/alerts/sendMessage", {
        method: "POST",
        body: JSON.stringify({ chat_id: "-1001", text: "hello" }),
      }),
      env,
    );

    expect(response.status).toBe(500);
    expect(await json(response)).toMatchObject({ error: { message: "API_KEY_IDS is not configured" } });
  });

  it("reports missing API key secrets", async () => {
    const response = await worker.fetch(
      request("/v1/bots/alerts/sendMessage", {
        method: "POST",
        body: JSON.stringify({ chat_id: "-1001", text: "hello" }),
      }),
      { ...baseEnv, API_KEY_INTERNAL: undefined },
    );

    expect(response.status).toBe(500);
    expect(await json(response)).toMatchObject({ error: { message: "Missing API key secret API_KEY_INTERNAL" } });
  });

  it("rejects unknown bot ids before calling Telegram", async () => {
    const fetchMock = mockTelegramFetch();
    const response = await worker.fetch(
      request("/v1/bots/missing/sendMessage", {
        method: "POST",
        body: JSON.stringify({ chat_id: "-1001", text: "hello" }),
      }),
      baseEnv,
    );

    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid bot ids", async () => {
    const response = await worker.fetch(
      request("/v1/bots/bad-id!/sendMessage", {
        method: "POST",
        body: JSON.stringify({ chat_id: "-1001", text: "hello" }),
      }),
      baseEnv,
    );

    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ error: { message: "Invalid bot id" } });
  });

  it("reports missing bot configuration", async () => {
    const env: Env = { ...baseEnv };
    delete env.BOT_IDS;

    const response = await worker.fetch(
      request("/v1/bots/alerts/sendMessage", {
        method: "POST",
        body: JSON.stringify({ chat_id: "-1001", text: "hello" }),
      }),
      env,
    );

    expect(response.status).toBe(500);
    expect(await json(response)).toMatchObject({ error: { message: "BOT_IDS is not configured" } });
  });

  it("reports missing bot token secrets", async () => {
    const response = await worker.fetch(
      request("/v1/bots/alerts/sendMessage", {
        method: "POST",
        body: JSON.stringify({ chat_id: "-1001", text: "hello" }),
      }),
      { ...baseEnv, TELEGRAM_BOT_ALERTS_TOKEN: undefined },
    );

    expect(response.status).toBe(500);
    expect(await json(response)).toMatchObject({ error: { message: "Missing bot token secret TELEGRAM_BOT_ALERTS_TOKEN" } });
  });

  it("rejects non-POST send requests", async () => {
    const response = await worker.fetch(
      request("/v1/bots/alerts/sendMessage", {
        method: "GET",
        headers: { "content-type": undefined as unknown as string },
      }),
      baseEnv,
    );

    expect(response.status).toBe(405);
    expect(await json(response)).toMatchObject({ error: { code: "METHOD_NOT_ALLOWED" } });
  });

  it("forwards sendMessage with chat, topic, and text payload", async () => {
    const fetchMock = mockTelegramFetch();
    const response = await worker.fetch(
      request("/v1/bots/alerts/sendMessage", {
        method: "POST",
        body: JSON.stringify({
          chat_id: "-100123",
          message_thread_id: 7,
          text: "deploy complete",
          parse_mode: "MarkdownV2",
        }),
      }),
      baseEnv,
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const [url, init] = firstCall as Parameters<typeof fetch>;

    expect(url).toBe("https://telegram.test/bot111:alerts-token/sendMessage");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({
      chat_id: "-100123",
      message_thread_id: 7,
      text: "deploy complete",
      parse_mode: "MarkdownV2",
    });
  });

  it("forwards urlencoded sendMessage payloads", async () => {
    const fetchMock = mockTelegramFetch();
    const env: Env = { ...baseEnv };
    delete env.TELEGRAM_API_BASE;

    const response = await worker.fetch(
      request("/v1/bots/alerts/sendMessage", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ chat_id: "-100123", text: "encoded" }).toString(),
      }),
      env,
    );

    expect(response.status).toBe(200);

    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const [url, init] = firstCall as Parameters<typeof fetch>;

    expect(url).toBe("https://api.telegram.org/bot111:alerts-token/sendMessage");
    expect(init?.body).toBe("chat_id=-100123&text=encoded");
  });

  it("forwards multipart photo uploads", async () => {
    const fetchMock = mockTelegramFetch();
    const formData = new FormData();
    formData.set("chat_id", "-100123");
    formData.set("photo", new Blob(["image-bytes"], { type: "image/png" }), "image.png");
    formData.set("caption", "upload");

    const response = await worker.fetch(
      request("/v1/bots/alerts/sendPhoto", {
        method: "POST",
        headers: {},
        body: formData,
      }),
      baseEnv,
    );

    expect(response.status).toBe(200);

    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const [, init] = firstCall as Parameters<typeof fetch>;
    expect(init?.body).toBeInstanceOf(FormData);
  });

  it("supports dynamic curated /send endpoint", async () => {
    const fetchMock = mockTelegramFetch();
    const response = await worker.fetch(
      request("/v1/bots/ops/send", {
        method: "POST",
        body: JSON.stringify({
          method: "sendPhoto",
          chat_id: "-100123",
          photo: "https://example.com/image.png",
          caption: "image",
        }),
      }),
      baseEnv,
    );

    expect(response.status).toBe(200);

    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const [url, init] = firstCall as Parameters<typeof fetch>;

    expect(url).toBe("https://telegram.test/bot222:ops-token/sendPhoto");
    expect(JSON.parse(init?.body as string)).toEqual({
      chat_id: "-100123",
      photo: "https://example.com/image.png",
      caption: "image",
    });
  });

  it("rejects dynamic sends without JSON", async () => {
    const response = await worker.fetch(
      request("/v1/bots/alerts/send", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "hello",
      }),
      baseEnv,
    );

    expect(response.status).toBe(415);
    expect(await json(response)).toMatchObject({ error: { code: "UNSUPPORTED_MEDIA_TYPE" } });
  });

  it("rejects dynamic sends with invalid method", async () => {
    const response = await worker.fetch(
      request("/v1/bots/alerts/send", {
        method: "POST",
        body: JSON.stringify({ method: "getMe", chat_id: "-1001" }),
      }),
      baseEnv,
    );

    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ error: { message: "Body method must be one of sendMessage, sendPhoto, sendDocument, sendMediaGroup" } });
  });

  it("rejects dynamic sends with missing required fields", async () => {
    const response = await worker.fetch(
      request("/v1/bots/alerts/send", {
        method: "POST",
        body: JSON.stringify({ method: "sendPhoto", chat_id: "-1001" }),
      }),
      baseEnv,
    );

    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ error: { message: "photo is required for sendPhoto" } });
  });

  it("rejects invalid curated payloads", async () => {
    const fetchMock = mockTelegramFetch();
    const response = await worker.fetch(
      request("/v1/bots/alerts/sendMessage", {
        method: "POST",
        body: JSON.stringify({ chat_id: "-1001" }),
      }),
      baseEnv,
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await json(response)).toMatchObject({
      error: { code: "BAD_REQUEST", message: "text is required for sendMessage" },
    });
  });

  it("rejects missing document and media fields", async () => {
    const documentResponse = await worker.fetch(
      request("/v1/bots/alerts/sendDocument", {
        method: "POST",
        body: JSON.stringify({ chat_id: "-1001" }),
      }),
      baseEnv,
    );
    const mediaResponse = await worker.fetch(
      request("/v1/bots/alerts/sendMediaGroup", {
        method: "POST",
        body: JSON.stringify({ chat_id: "-1001" }),
      }),
      baseEnv,
    );

    expect(documentResponse.status).toBe(400);
    expect(mediaResponse.status).toBe(400);
    expect(await json(documentResponse)).toMatchObject({ error: { message: "document is required for sendDocument" } });
    expect(await json(mediaResponse)).toMatchObject({ error: { message: "media is required for sendMediaGroup" } });
  });

  it("rejects invalid JSON bodies", async () => {
    const malformedResponse = await worker.fetch(
      request("/v1/bots/alerts/sendMessage", {
        method: "POST",
        body: "{",
      }),
      baseEnv,
    );
    const arrayResponse = await worker.fetch(
      request("/v1/bots/alerts/sendMessage", {
        method: "POST",
        body: JSON.stringify([]),
      }),
      baseEnv,
    );

    expect(malformedResponse.status).toBe(400);
    expect(arrayResponse.status).toBe(400);
    expect(await json(malformedResponse)).toMatchObject({ error: { message: "Request body must be valid JSON" } });
    expect(await json(arrayResponse)).toMatchObject({ error: { message: "Request body must be a JSON object" } });
  });

  it("rejects unsupported send content types", async () => {
    const response = await worker.fetch(
      request("/v1/bots/alerts/sendMessage", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "hello",
      }),
      baseEnv,
    );

    expect(response.status).toBe(415);
    expect(await json(response)).toMatchObject({ error: { code: "UNSUPPORTED_MEDIA_TYPE" } });
  });

  it("rejects invalid form and urlencoded payloads", async () => {
    const formData = new FormData();
    formData.set("chat_id", "-100123");
    const formResponse = await worker.fetch(
      request("/v1/bots/alerts/sendPhoto", {
        method: "POST",
        headers: {},
        body: formData,
      }),
      baseEnv,
    );
    const encodedResponse = await worker.fetch(
      request("/v1/bots/alerts/sendMessage", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ text: "missing chat" }).toString(),
      }),
      baseEnv,
    );

    expect(formResponse.status).toBe(400);
    expect(encodedResponse.status).toBe(400);
    expect(await json(formResponse)).toMatchObject({ error: { message: "photo is required for sendPhoto" } });
    expect(await json(encodedResponse)).toMatchObject({ error: { message: "chat_id is required" } });
  });

  it("keeps generic Telegram proxy disabled by default", async () => {
    const fetchMock = mockTelegramFetch();
    const response = await worker.fetch(
      request("/v1/bots/alerts/telegram/getMe", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      baseEnv,
    );

    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects invalid generic proxy methods when enabled", async () => {
    const response = await worker.fetch(
      request("/v1/bots/alerts/telegram/bad-method", {
        method: "POST",
        body: JSON.stringify({}),
      }),
      { ...baseEnv, ENABLE_TELEGRAM_PROXY: "yes" },
    );

    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ error: { message: "Invalid Telegram method" } });
  });

  it("rejects non-POST generic proxy requests", async () => {
    const response = await worker.fetch(
      request("/v1/bots/alerts/telegram/getMe", {
        method: "GET",
        headers: { "content-type": undefined as unknown as string },
      }),
      { ...baseEnv, ENABLE_TELEGRAM_PROXY: "true" },
    );

    expect(response.status).toBe(405);
    expect(await json(response)).toMatchObject({ error: { message: "Use POST for Telegram proxy endpoints" } });
  });

  it("forwards generic proxy requests when enabled", async () => {
    const fetchMock = mockTelegramFetch();
    const response = await worker.fetch(
      request("/v1/bots/alerts/telegram/getChat", {
        method: "POST",
        body: JSON.stringify({ chat_id: "-100123" }),
      }),
      { ...baseEnv, ENABLE_TELEGRAM_PROXY: "true" },
    );

    expect(response.status).toBe(200);

    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const [url, init] = firstCall as Parameters<typeof fetch>;

    expect(url).toBe("https://telegram.test/bot111:alerts-token/getChat");
    expect(JSON.parse(init?.body as string)).toEqual({ chat_id: "-100123" });
  });

  it("returns upstream errors when Telegram fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async () => {
        throw new Error("network down");
      }),
    );

    const response = await worker.fetch(
      request("/v1/bots/alerts/sendMessage", {
        method: "POST",
        body: JSON.stringify({ chat_id: "-100123", text: "hello" }),
      }),
      baseEnv,
    );

    expect(response.status).toBe(502);
    expect(await json(response)).toMatchObject({ error: { code: "UPSTREAM_ERROR" } });
  });
});

describe("configuration helpers", () => {
  it("parses identifiers and filters invalid values", () => {
    expect([...parseIdentifierList(" alerts,bad-id!,OPS_1,, ")].sort()).toEqual(["ALERTS", "OPS_1"]);
  });

  it("parses enabled flags", () => {
    expect(isEnabled("on")).toBe(true);
    expect(isEnabled("1")).toBe(true);
    expect(isEnabled("false")).toBe(false);
    expect(isEnabled(undefined)).toBe(false);
  });

  it("normalizes Telegram API base URLs and timeout values", () => {
    expect(telegramApiBase({ TELEGRAM_API_BASE: "https://telegram.test///" })).toBe("https://telegram.test");
    expect(telegramTimeoutMs({ TELEGRAM_TIMEOUT_MS: "1500" })).toBe(1500);
    expect(telegramTimeoutMs({ TELEGRAM_TIMEOUT_MS: "999" })).toBe(10000);
    expect(telegramTimeoutMs({ TELEGRAM_TIMEOUT_MS: "not-a-number" })).toBe(10000);
  });
});
