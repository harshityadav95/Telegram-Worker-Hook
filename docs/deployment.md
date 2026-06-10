# Deployment Guide

## Local deploy

Install dependencies and log in:

```bash
pnpm install
pnpm exec wrangler login
```

Create secrets:

```bash
pnpm exec wrangler secret put TELEGRAM_BOT_ALERTS_TOKEN
pnpm exec wrangler secret put API_KEY_INTERNAL
```

Validate and deploy:

```bash
pnpm typecheck
pnpm test
pnpm coverage
pnpm dry-run
pnpm deploy
```

## GitHub Actions deploy

Repository secrets required:

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | API token with Worker deploy permissions. |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account id. |

Recommended Cloudflare API token permissions:

- Account: Workers Scripts Edit
- Account: Workers Routes Edit, if using custom routes
- Account: Account Settings Read

The workflow uses `ubuntu-24.04-arm` for CI. If your GitHub plan or repository does not have that hosted runner available, change the workflow runner to a self-hosted ARM64 label or `ubuntu-latest`.

## Production checklist

- Set `BOT_IDS` to only the bot aliases you use.
- Set `API_KEY_IDS` to only active clients.
- Keep `ENABLE_TELEGRAM_PROXY=false` unless a trusted service needs advanced Telegram methods.
- Keep `TELEGRAM_TIMEOUT_MS` conservative. The default `10000` avoids tying up Worker requests indefinitely.
- Rotate leaked API keys by creating a new `API_KEY_<ID>` secret and removing the old id from `API_KEY_IDS`.
- Verify a real send to every configured bot before connecting production systems.
