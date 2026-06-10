import type { RouteMatch } from "./types";

const SEND_ENDPOINT_METHODS: Record<string, string> = {
  sendmessage: "sendMessage",
  sendphoto: "sendPhoto",
  senddocument: "sendDocument",
  sendmediagroup: "sendMediaGroup",
};

export function matchRoute(request: Request): RouteMatch {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);

  if (request.method === "GET" && parts.length === 1 && parts[0] === "health") {
    return { kind: "health" };
  }

  if (request.method === "GET" && parts.length === 1 && parts[0] === "version") {
    return { kind: "version" };
  }

  if (parts.length >= 4 && parts[0] === "v1" && parts[1] === "bots") {
    const botId = parts[2];
    const action = parts[3]?.toLowerCase();

    if (!botId || !action) {
      return { kind: "notFound" };
    }

    if (parts.length === 4 && action === "send") {
      return { kind: "sendDynamic", botId };
    }

    const sendMethod = SEND_ENDPOINT_METHODS[action];
    if (parts.length === 4 && sendMethod) {
      return { kind: "send", botId, method: sendMethod };
    }

    if (parts.length === 5 && action === "telegram") {
      return { kind: "proxy", botId, method: parts[4] || "" };
    }
  }

  return { kind: "notFound" };
}
