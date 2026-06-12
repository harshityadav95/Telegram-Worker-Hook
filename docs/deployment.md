# Deployment Guide

## Prerequisites

- A Cloudflare account with Workers enabled.
- A GitHub repository containing this project.
- `pnpm` installed locally.
- At least one Telegram bot token and one API key value for callers.

## Local deploy

Install dependencies and log in:

```bash
pnpm install --frozen-lockfile
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

The repository includes two workflows:

- `.github/workflows/ci.yml` runs typecheck, tests, coverage, lint, and Wrangler dry run.
- `.github/workflows/deploy.yml` deploys the Worker when changes land on `main` or when manually triggered.

Both workflows use the GitHub-hosted ARM runner label:

```yaml
runs-on: ubuntu-24.04-arm
```

If that runner is unavailable for your repository, change both workflow files to `ubuntu-latest` or to your self-hosted ARM64 runner label.

## Cloudflare API token

Create a token in Cloudflare:

1. Open **Cloudflare Dashboard -> Manage Account -> API Tokens**.
2. Select **Create Token**.
3. Use the **Edit Cloudflare Workers** template or create a custom token.
4. Scope the token to only the Cloudflare account that owns this Worker.

Recommended permissions:

- `Account: Workers Scripts: Edit`
- `Account: Account Settings: Read`
- `Zone: Workers Routes: Edit`, only if deploying custom routes

## GitHub repository secrets

In GitHub, open **Settings -> Secrets and variables -> Actions -> New repository secret**.

Repository secrets required:

| Secret | Purpose |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | API token with Worker deploy permissions. |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account id. |

Do not store Telegram bot tokens or caller API keys as GitHub secrets for normal operation. They should be Cloudflare Worker runtime secrets.

## Worker configuration

Set non-secret Worker variables in `wrangler.toml`:

```toml
[vars]
BOT_IDS = "alerts,ops"
API_KEY_IDS = "internal"
ENABLE_TELEGRAM_PROXY = "false"
TELEGRAM_API_BASE = "https://api.telegram.org"
TELEGRAM_TIMEOUT_MS = "10000"
```

Create matching Cloudflare runtime secrets:

```bash
pnpm exec wrangler secret put TELEGRAM_BOT_ALERTS_TOKEN
pnpm exec wrangler secret put TELEGRAM_BOT_OPS_TOKEN
pnpm exec wrangler secret put API_KEY_INTERNAL
```

Secret name mapping:

| Alias/id | Required secret |
| --- | --- |
| Bot id `alerts` | `TELEGRAM_BOT_ALERTS_TOKEN` |
| Bot id `ops` | `TELEGRAM_BOT_OPS_TOKEN` |
| API key id `internal` | `API_KEY_INTERNAL` |

After changing runtime secrets, redeploy locally with `pnpm deploy` or rerun the GitHub **Deploy** workflow.

## First GitHub deployment

Commit and push to `main`:

```bash
git add .
git commit -m "Add Telegram Worker deployment"
git push origin main
```

If your default branch is `master`, either push to `main` or update `.github/workflows/deploy.yml` to include `master`.

Manual deploys are available from **GitHub -> Actions -> Deploy -> Run workflow**.

## Production smoke test

Replace the URL, API key, and chat id:

```bash
curl -X POST "https://telegram-worker-hook.YOUR_SUBDOMAIN.workers.dev/v1/bots/alerts/sendMessage" \
  -H "content-type: application/json" \
  -H "X-API-Key-Id: internal" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"chat_id":"-1001234567890","text":"Worker deployed"}'
```

## Production checklist

- Set `BOT_IDS` to only the bot aliases you use.
- Set `API_KEY_IDS` to only active clients.
- Keep `ENABLE_TELEGRAM_PROXY=false` unless a trusted service needs advanced Telegram methods.
- Keep `TELEGRAM_TIMEOUT_MS` conservative. The default `10000` avoids tying up Worker requests indefinitely.
- Rotate leaked API keys by creating a new `API_KEY_<ID>` secret and removing the old id from `API_KEY_IDS`.
- Verify a real send to every configured bot before connecting production systems.
