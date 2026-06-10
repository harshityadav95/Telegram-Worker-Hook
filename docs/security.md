# Security Guide

## Secrets

Bot tokens and API keys must be stored as Cloudflare Worker secrets:

```bash
wrangler secret put TELEGRAM_BOT_ALERTS_TOKEN
wrangler secret put API_KEY_INTERNAL
```

Never commit `.dev.vars`, `.env`, bot tokens, chat ids that must remain private, or production API keys.

## API authentication

Every send/proxy route requires:

- `X-API-Key-Id`
- `X-API-Key`

The key id selects `API_KEY_<ID>`. The Worker hashes both submitted and expected values before comparison to avoid direct string comparison timing leaks.

## Bot isolation

Bot aliases must be listed in `BOT_IDS`. Unknown aliases are rejected before the Worker reads a token secret. This prevents accidental use of unplanned secret names.

## Generic proxy

The generic proxy can call any Telegram Bot API method using the selected bot token. Keep it disabled by default:

```env
ENABLE_TELEGRAM_PROXY=false
```

Enable it only for trusted callers that need advanced Telegram methods.

## Logging

Do not log:

- Telegram bot tokens
- API keys
- Full request headers
- Uploaded file contents

If observability is added later, log only request ids, route names, bot aliases, key ids, response status, and Telegram method names.

## Reliability

Telegram sends are not retried automatically because retrying a successful-but-slow send can duplicate messages. Use caller-side idempotency or operational deduplication if you add retries later.
