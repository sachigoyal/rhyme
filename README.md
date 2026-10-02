# Rhyme

A personal whiteboard project for sketches, diagrams, and ideas, with an AI assistant that can edit the canvas.

Built with tldraw, React, TanStack Start, and Cloudflare Workers, D1, and R2.

## Run locally

Requires Node.js 22+ and pnpm 11.25.0.

1. Run `pnpm install --frozen-lockfile`.
2. Copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars` and set `BETTER_AUTH_SECRET` (at least 32 characters).
3. Copy `apps/web/.env.example` to `apps/web/.env`.
4. Run `pnpm --filter api exec wrangler login`, then `pnpm db:migrate` and `pnpm dev`.
5. Open [localhost:3000](http://localhost:3000).

Sign-in codes appear in the API console. Workers AI uses your Cloudflare account even locally.

## AI

Built-in models include 100,000 tokens per user per calendar month (UTC), shared across chats. Set `AI_MONTHLY_TOKEN_LIMIT` in the Worker configuration to change this; `0` requires personal keys. Input and output tokens count, and an in-flight model step may cross the limit before further calls are blocked. Built-in conversation titles use a local fallback to avoid extra AI usage.

At the limit, a banner opens AI connections. Add an OpenAI, Anthropic, Gemini, or OpenAI-compatible key and select its model to continue. Keys are encrypted and usage is billed to your provider. Set a stable `BYOK_ENCRYPTION_KEY` Worker secret before accepting keys in production; otherwise encryption uses `BETTER_AUTH_SECRET`.

## Commands

- `pnpm test`, `pnpm check-types`, `pnpm lint`, `pnpm build` — validation.
- `pnpm lint:fix`, `pnpm format`, `pnpm format:check` — fix lint, format, and check formatting.
- `pnpm db:generate`, `pnpm db:migrate` — generate and apply local migrations.
- `pnpm run deploy` — build, migrate, and deploy using `apps/api/wrangler.production.jsonc`.

Linting uses [Oxlint](https://oxc.rs/docs/guide/usage/linter); formatting uses [Oxfmt](https://oxc.rs/docs/guide/usage/formatter). Both run across the repository, excluding generated files and build outputs.

Production canvases require `VITE_TLDRAW_LICENSE_KEY`. See [AGENTS.md](AGENTS.md) for repository conventions.

GitHub Actions runs type checks, Oxlint, Oxfmt checks, tests, and production packaging for pull requests and pushes to `main`. Successful pushes to `main` deploy to [rhyme.sachi.dev](https://rhyme.sachi.dev); the workflow can also be run manually from `main`. Set the repository Actions secret `CLOUDFLARE_API_TOKEN` with Workers deployment and D1 migration permissions for the account in `wrangler.production.jsonc`. Production Worker secrets remain configured in Cloudflare.

## License

[MIT](LICENSE). Dependencies retain their own licenses.
