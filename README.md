# Telegram Worker Hook

Reusable Cloudflare Worker for sending Telegram bot messages from one stable HTTPS endpoint. It supports multiple Telegram bots, multiple caller API keys, channels, groups, and forum topics without storing tokens in source control.

## Features

- Multiple bots selected by URL alias, backed by Cloudflare Worker secrets.
- Multiple caller API keys selected with `X-API-Key-Id`.
- Curated endpoints for `sendMessage`, `sendPhoto`, `sendDocument`, and `sendMediaGroup`.
- Optional generic Telegram Bot API proxy for advanced bot methods.
- Supports JSON, `multipart/form-data`, and `application/x-www-form-urlencoded`.
- Designed for Cloudflare Workers with fast cold starts and minimal dependencies.
- GitHub Actions validates builds only; deployment is handled directly in Cloudflare.

## API

All send endpoints require:

```http
X-API-Key-Id: internal
X-API-Key: your-api-key-value
Content-Type: application/json
```

Send a text message:

```bash
curl -X POST "https://YOUR_WORKER.workers.dev/v1/bots/alerts/sendMessage" \
  -H "content-type: application/json" \
  -H "X-API-Key-Id: internal" \
  -H "X-API-Key: $API_KEY_INTERNAL" \
  -d '{
    "chat_id": "-1001234567890",
    "message_thread_id": 7,
    "text": "Deploy complete",
    "parse_mode": "MarkdownV2"
  }'
```

Send a photo by URL:

```bash
curl -X POST "https://YOUR_WORKER.workers.dev/v1/bots/alerts/sendPhoto" \
  -H "content-type: application/json" \
  -H "X-API-Key-Id: internal" \
  -H "X-API-Key: $API_KEY_INTERNAL" \
  -d '{
    "chat_id": "-1001234567890",
    "photo": "https://example.com/image.png",
    "caption": "Status image"
  }'
```

Upload a document:

```bash
curl -X POST "https://YOUR_WORKER.workers.dev/v1/bots/alerts/sendDocument" \
  -H "X-API-Key-Id: internal" \
  -H "X-API-Key: $API_KEY_INTERNAL" \
  -F "chat_id=-1001234567890" \
  -F "document=@./report.pdf" \
  -F "caption=Daily report"
```

Dynamic curated endpoint:

```bash
curl -X POST "https://YOUR_WORKER.workers.dev/v1/bots/alerts/send" \
  -H "content-type: application/json" \
  -H "X-API-Key-Id: internal" \
  -H "X-API-Key: $API_KEY_INTERNAL" \
  -d '{
    "method": "sendMessage",
    "chat_id": "-1001234567890",
    "text": "Hello from the shared Worker"
  }'
```

Optional generic proxy:

```bash
curl -X POST "https://YOUR_WORKER.workers.dev/v1/bots/alerts/telegram/getChat" \
  -H "content-type: application/json" \
  -H "X-API-Key-Id: internal" \
  -H "X-API-Key: $API_KEY_INTERNAL" \
  -d '{ "chat_id": "-1001234567890" }'
```

The generic proxy is disabled unless `ENABLE_TELEGRAM_PROXY=true`.

## Configuration

The Cloudflare Worker is named `telegramwebhook` in `wrangler.toml`.

Non-secret Worker variables:

| Name | Example | Description |
| --- | --- | --- |
| `BOT_IDS` | `alerts,ops` | Allowed bot aliases. |
| `API_KEY_IDS` | `internal,monitoring` | Allowed caller API key ids. |
| `ENABLE_TELEGRAM_PROXY` | `false` | Enables `/telegram/:method` when `true`. |
| `TELEGRAM_API_BASE` | `https://api.telegram.org` | Telegram API base URL. |
| `TELEGRAM_TIMEOUT_MS` | `10000` | Telegram request timeout, from 1000 to 30000 ms. |
| `CORS_ORIGIN` | `https://example.com` | Optional CORS origin. Defaults to `*`. |

Secret names are derived from aliases:

```bash
wrangler secret put TELEGRAM_BOT_ALERTS_TOKEN
wrangler secret put TELEGRAM_BOT_OPS_TOKEN
wrangler secret put API_KEY_INTERNAL
wrangler secret put API_KEY_MONITORING
```

Aliases are case-insensitive in requests, then normalized to uppercase `A-Z`, `0-9`, and `_`.

## Development

```bash
pnpm install --frozen-lockfile
cp .dev.vars.example .dev.vars
pnpm dev
```

Checks:

```bash
pnpm typecheck
pnpm test
pnpm coverage
pnpm lint
pnpm dry-run
```

## Deployment

Deploy from Cloudflare directly. The GitHub Actions workflow does not deploy; it only verifies that changes are valid by running install, typecheck, tests, coverage, lint, and Wrangler dry run.

## Documentation

- [Setup guide](docs/setup.md)
- [Deployment guide](docs/deployment.md)
- [Testing guide](docs/testing.md)
- [Security guide](docs/security.md)

## License

MIT
