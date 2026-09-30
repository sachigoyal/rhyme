# Rhyme

A canvas-first workspace for sketches, diagrams, and ideas, with an AI assistant that can edit the live whiteboard.

## Local development

Requires Node.js 22+ and pnpm 11.25.0. Install with `pnpm install --frozen-lockfile`.

Copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars` and set a random `BETTER_AUTH_SECRET` of at least 32 characters. Copy `apps/web/.env.example` to `apps/web/.env`. These local files are ignored by Git.

Run `pnpm --filter api exec wrangler login` using the Cloudflare account for the project, then `pnpm db:migrate` and `pnpm dev`. Open [localhost:3000](http://localhost:3000). The API runs at [localhost:8787](http://localhost:8787).

D1, R2, email, and Durable Objects are simulated locally. Sign-in codes appear in the Wrangler console. Workers AI uses the authenticated Cloudflare account even during local development. The model is configured with `AI_MODEL` in `apps/api/wrangler.jsonc`.

A tldraw production license is configured with `VITE_TLDRAW_LICENSE_KEY`. Local development works without one.

## Product flows

- `/` opens a temporary guest canvas or the signed-in user's most recently edited canvas. Guests can draw freely; account creation carries the drawing into a saved canvas.
- `/sign-in` uses email verification codes for signup and returning users.
- `/onboarding` collects a name, optional work context, and an explicit choice about optional analytics. Responses are saved to the user's profile.
- `/files` organizes owned, shared, and trashed canvases and folders, with search and sorting.
- `/chats` shows private conversations with generated titles. Open a conversation to chat without a visible canvas; edits use the normal canvas save flow. The context popover contains canvas links, run statistics, and saved change previews.
- `/activity` summarizes agent runs, token usage, tools, errors, and response duration.

Each conversation has its own Durable Object, scoped to its canvas and user. D1 indexes conversations, runs, and changes; Durable Object SQLite stores messages; R2 stores canvas documents, assets, and immutable change previews. History remains subject to current canvas permissions. Client tools apply changes through tldraw's normal undo and save system.

The composer offers a model selector saved per conversation. Selecting a model uses its default generation settings and applies to the next response. Each turn retains its configuration across tool continuations. Text-only models receive canvas shape context without images; run analytics record the selected model.

## Validation

Run `pnpm test`, `pnpm check-types`, `pnpm lint`, and `pnpm build`. Tests cover canvas-tool replay safety, input validation, shape IDs, nested coordinate moves, change summaries, and conversation-title generation safeguards. For schema changes, run `pnpm db:generate` followed by `pnpm db:migrate` to apply local D1 migrations. `pnpm --filter api exec wrangler deploy --dry-run` checks Worker packaging without deploying.

See [AGENTS.md](AGENTS.md) for the repository layout and conventions.
