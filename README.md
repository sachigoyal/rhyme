# Rhyme

A canvas-first workspace for sketches, diagrams, and ideas, with an AI assistant that can edit the live whiteboard.

## Local development

Requires Node.js 22+ and pnpm 11.25.0. Install with `pnpm install --frozen-lockfile`.

Copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars` and set a random `BETTER_AUTH_SECRET` of at least 32 characters. Copy `apps/web/.env.example` to `apps/web/.env`. These local files are ignored by Git.

Run `pnpm --filter api exec wrangler login` using the Cloudflare account for the project, then `pnpm db:migrate` and `pnpm dev`. Open [localhost:3000](http://localhost:3000). The API runs at [localhost:8787](http://localhost:8787).

D1, R2, email, and Durable Objects are simulated locally. Sign-in codes appear in the Wrangler console. Workers AI uses the authenticated Cloudflare account even during local development. The model is configured with `AI_MODEL` in `apps/api/wrangler.jsonc`.

A tldraw production license is configured with `VITE_TLDRAW_LICENSE_KEY`. Local development works without one.

## Web hosting

The web app runs in SPA mode. `pnpm --filter web build` creates the static client in `apps/web/dist/client`. Serve the generated HTML files at extensionless URLs for `/`, `/sign-in`, `/onboarding`, `/auth/complete`, `/files`, `/chats`, `/activity`, and `/settings`. Rewrite `/files/*` to `/_shell`, serve assets normally, and use `404.html` with HTTP status 404 for unknown URLs. [Cloudflare Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/) reads the included `_redirects` and `_headers` files and uses `404.html` automatically. The API stays on its own Worker; configure `VITE_API_URL` before building.

Route authentication and data loading run in the browser. Intent preloading warms route code and metadata, while canvas documents are fetched fresh for each editing session. Static shells contain route metadata and loading placeholders, with no account data or runtime SSR. The build renders `404.html` from the root not-found boundary so unknown URLs hydrate with the correct error state.

## Search and social previews

Set `VITE_SITE_URL` to the public HTTPS origin before a production build, and set `VITE_ALLOW_INDEXING=true`. Localhost builds and builds with `VITE_ALLOW_INDEXING=false` are excluded from indexing. Use the latter for preview environments. The production origin supplies absolute canonical, Open Graph, image, and sitemap URLs.

Metadata lives in `apps/web/src/lib/seo.ts`. The public whiteboard is the only indexable route and the only URL in the sitemap. Sign-in, setup, canvases, conversations, activity, and errors use `noindex` in the built HTML; private routes also receive an `X-Robots-Tag` header. Robots rules allow production crawling so crawlers can read those directives. Canvas previews use generic product metadata rather than private names or drawings. Shared and trash views have distinct client metadata; their initial HTML uses the canvases preview because they are query variants of `/files`.

The build generates 1200 × 630 PNG previews and editable SVGs in `apps/web/public/og`, using the brand SVG paths and outlined Geist text. Run `pnpm --filter web generate:og` after changing preview copy or illustrations. The font source and license are in `apps/web/scripts/fonts`. Increment `SEO_IMAGE_VERSION` when changing published preview artwork. `pnpm --filter web check:seo` verifies the built titles, metadata, privacy rules, headings, and image dimensions; it runs automatically after every web build.

## Product flows

- `/` opens the full drawing canvas for guests and the dashboard for signed-in users by default. The home-page preference can instead open the most recent accessible canvas they edited. Guest drawings, pages, and inline media autosave to localStorage. Assistant, sharing, and workspace actions open sign-in. Verified sign-in imports the guest drawing once into an owned file before onboarding; retries keep the same file ID and never overwrite an existing canvas. The dashboard is the destination after setup.
- `/sign-in` uses email verification codes for signup and returning users.
- `/onboarding` collects a name, optional work context, and an explicit choice about optional analytics. The current question and answers persist in localStorage per account and resume on this device after closing the page. Only successful completion clears the draft; responses are saved to the user's profile. Incomplete profiles must finish setup before entering the workspace.
- `/files` organizes owned, shared, and trashed canvases and folders, with search and sorting.
- `/chats` shows private conversations with generated titles. Open a conversation to chat without a visible canvas; edits use the normal canvas save flow. The context popover contains canvas links, run statistics, and saved change previews.
- `/activity` summarizes agent runs, token usage, tools, errors, and response duration.

Each conversation has its own Durable Object, scoped to its canvas and user. D1 indexes conversations, runs, and changes; Durable Object SQLite stores messages; R2 stores canvas documents, assets, and immutable change previews. History remains subject to current canvas permissions. Client tools apply changes through tldraw's normal undo and save system.

The composer offers a model selector saved per conversation. Selecting a model uses its default generation settings and applies to the next response. Each turn retains its configuration across tool continuations. Text-only models receive canvas shape context without images; run analytics record the selected model.

## Validation

Run `pnpm test`, `pnpm check-types`, `pnpm lint`, and `pnpm build`. Tests cover canvas-tool replay safety, input validation, shape IDs, nested coordinate moves, change summaries, and conversation-title generation safeguards. For schema changes, run `pnpm db:generate` followed by `pnpm db:migrate` to apply local D1 migrations. `pnpm --filter api exec wrangler deploy --dry-run` checks Worker packaging without deploying.

See [AGENTS.md](AGENTS.md) for the repository layout and conventions.

- `/settings` saves account preferences in D1: home destination, theme, canvas grid, shape snapping, and assistant visibility. Changes are optimistic with rollback on failure; canvas defaults apply on opening. Display name and analytics controls update the existing profile. Reset restores workspace defaults without changing profile or consent.

## Production deployment

`pnpm deploy` builds the SPA for `https://rhyme.sachi.dev`, applies remote D1 migrations, and deploys the `rhyme` Worker with the static client, API, and canvas assistant. Production configuration is in `apps/api/wrangler.production.jsonc`; local development continues to use `wrangler.jsonc`. The `BETTER_AUTH_SECRET` is stored as a Worker secret. Sign-in email is sent from `auth@rhyme.sachi.dev` through the configured Cloudflare Email Sending domain.

Run `pnpm --filter api types:production` after changing production bindings.
