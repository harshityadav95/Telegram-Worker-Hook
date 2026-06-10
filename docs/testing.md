# Testing Guide

## Automated checks

```bash
pnpm typecheck
pnpm test
pnpm coverage
pnpm lint
```

The unit tests mock Telegram API calls. They validate authentication, bot selection, payload validation, curated send endpoints, and generic proxy behavior.

## Local integration test

Start the Worker:

```bash
pnpm dev
```

Send a message:

```bash
curl -X POST "http://127.0.0.1:8787/v1/bots/alerts/sendMessage" \
  -H "content-type: application/json" \
  -H "X-API-Key-Id: internal" \
  -H "X-API-Key: $API_KEY_INTERNAL" \
  -d '{
    "chat_id": "-1001234567890",
    "text": "Local Worker test"
  }'
```

Send to a topic:

```bash
curl -X POST "http://127.0.0.1:8787/v1/bots/alerts/sendMessage" \
  -H "content-type: application/json" \
  -H "X-API-Key-Id: internal" \
  -H "X-API-Key: $API_KEY_INTERNAL" \
  -d '{
    "chat_id": "-1001234567890",
    "message_thread_id": 7,
    "text": "Topic test"
  }'
```

Upload media:

```bash
curl -X POST "http://127.0.0.1:8787/v1/bots/alerts/sendPhoto" \
  -H "X-API-Key-Id: internal" \
  -H "X-API-Key: $API_KEY_INTERNAL" \
  -F "chat_id=-1001234567890" \
  -F "photo=@./image.png" \
  -F "caption=Upload test"
```

## Troubleshooting

- `401 UNAUTHORIZED`: check `X-API-Key-Id`, `X-API-Key`, `API_KEY_IDS`, and the matching `API_KEY_<ID>` secret.
- `404 Unknown bot id`: check `BOT_IDS` and the URL bot alias.
- `500 Missing bot token secret`: create `TELEGRAM_BOT_<BOT_ID>_TOKEN`.
- Telegram `400 Bad Request`: verify `chat_id`, bot permissions, and required Telegram method fields.
