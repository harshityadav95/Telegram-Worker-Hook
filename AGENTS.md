# Repository Guidelines

## Project Structure & Module Organization

This is a TypeScript Cloudflare Worker for authenticated Telegram Bot API sends.

- `src/index.ts` is the Worker entrypoint.
- `src/auth.ts`, `src/config.ts`, `src/router.ts`, `src/http.ts`, and `src/telegram.ts` hold focused runtime modules.
- `src/types.ts` contains shared type definitions.
- `test/worker.test.ts` contains Vitest unit tests with mocked Telegram fetches.
- `docs/` contains setup, deployment, testing, and security guides.
- `wrangler.toml` defines Cloudflare Worker bindings and default non-secret vars.

Do not commit generated output such as `coverage/`, `dist/`, `.wrangler/`, `.dev.vars`, or `.env`.

## Build, Test, and Development Commands

Use pnpm only. The `preinstall` script rejects other package managers.

- `pnpm install --frozen-lockfile` installs exact locked dependencies.
- `pnpm dev` starts `wrangler dev` locally.
- `pnpm typecheck` runs TypeScript without emitting files.
- `pnpm lint` runs ESLint.
- `pnpm test` runs the Vitest suite.
- `pnpm coverage` runs tests with coverage thresholds.
- `pnpm dry-run` validates the Worker bundle with Wrangler.
- `pnpm deploy` deploys to Cloudflare.

## Coding Style & Naming Conventions

Write strict TypeScript with small, single-purpose modules. Use 2-space indentation, explicit exported types, and descriptive function names. Prefer Web Platform APIs available in Workers over Node-only APIs.

Environment-derived aliases are normalized to uppercase identifiers. Follow these secret naming patterns:

- `TELEGRAM_BOT_<BOT_ID>_TOKEN`
- `API_KEY_<KEY_ID>`

Keep bot ids and key ids limited to `A-Z`, `0-9`, and `_`.

## Testing Guidelines

Tests use Vitest. Mock external Telegram calls; do not hit the real Telegram API in unit tests. Add tests for auth, config resolution, routing, validation, and upstream failures when changing runtime behavior.

Coverage must stay above 90% globally for statements, branches, functions, and lines. Run:

```bash
pnpm coverage
```

## Commit & Pull Request Guidelines

The repository currently has minimal history, so use clear imperative commit messages, for example `Add media upload validation`.

Pull requests should include:

- A short summary of behavior changes.
- Linked issue or context when available.
- Test evidence, usually `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm coverage`, and `pnpm dry-run`.
- Documentation updates for changed setup, API, secrets, or deployment behavior.

## Security & Configuration Tips

Never commit bot tokens, API keys, `.dev.vars`, or `.env`. Keep `ENABLE_TELEGRAM_PROXY=false` unless a trusted caller needs advanced Telegram methods. Update `docs/security.md` when changing authentication, logging, or proxy behavior.
