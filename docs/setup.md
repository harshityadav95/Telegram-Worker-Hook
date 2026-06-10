# Setup Guide

## 1. Create a Telegram bot

1. Open Telegram and start a chat with `@BotFather`.
2. Run `/newbot`.
3. Choose a display name and username.
4. Copy the token BotFather returns. It looks like `123456789:ABC...`.

Store the token only as a Cloudflare secret. Do not commit it to Git.

## 2. Add the bot to a destination

For a group:

1. Add the bot to the group.
2. Give it permission to send messages.
3. Send a test message in the group.

For a channel:

1. Add the bot as an administrator.
2. Give it permission to post messages.

For a forum topic:

1. Enable topics in the Telegram group.
2. Create or open the target topic.
3. Use its `message_thread_id` in Worker requests.

## 3. Find `chat_id`

Common options:

- Forward a message from the group/channel to a chat-id helper bot.
- Temporarily call Telegram `getUpdates` for your bot after sending a message in the target chat.
- Use the Worker generic proxy locally after enabling `ENABLE_TELEGRAM_PROXY=true`.

Group and channel ids often start with `-100`.

## 4. Configure local development

```bash
pnpm install
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars`:

```env
BOT_IDS=alerts,ops
API_KEY_IDS=internal
TELEGRAM_BOT_ALERTS_TOKEN=123456789:real-token
TELEGRAM_BOT_OPS_TOKEN=987654321:real-token
API_KEY_INTERNAL=use-a-long-random-secret
ENABLE_TELEGRAM_PROXY=false
TELEGRAM_TIMEOUT_MS=10000
```

Run locally:

```bash
pnpm dev
```

## 5. Configure Cloudflare secrets

```bash
wrangler secret put TELEGRAM_BOT_ALERTS_TOKEN
wrangler secret put API_KEY_INTERNAL
```

Set non-secret vars in `wrangler.toml` or through Cloudflare dashboard.
