import { authenticate } from "./auth";
import { resolveBotToken } from "./config";
import { errorResponse, jsonResponse, optionsResponse } from "./http";
import { matchRoute } from "./router";
import { forwardCuratedSend, forwardDynamicSend, forwardProxy } from "./telegram";
import type { Env } from "./types";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return optionsResponse(env);
    }

    const route = matchRoute(request);

    if (route.kind === "health") {
      return jsonResponse({ ok: true, service: "telegram-worker-hook" }, undefined, env);
    }

    if (route.kind === "version") {
      return jsonResponse({ ok: true, version: env.PACKAGE_VERSION || "0.1.0" }, undefined, env);
    }

    if (route.kind === "notFound") {
      return errorResponse(404, "NOT_FOUND", "Route not found", undefined, env);
    }

    const auth = await authenticate(request, env);
    if (!auth.ok) {
      return auth.response;
    }

    const tokenOrResponse = resolveBotToken(route.botId, env);
    if (tokenOrResponse instanceof Response) {
      return tokenOrResponse;
    }

    if (route.kind === "send") {
      return forwardCuratedSend(request, env, tokenOrResponse, route.method);
    }

    if (route.kind === "sendDynamic") {
      return forwardDynamicSend(request, env, tokenOrResponse);
    }

    return forwardProxy(request, env, tokenOrResponse, route.method);
  },
};
