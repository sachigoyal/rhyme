# Rhyme

tldraw-style whiteboard: users sign in, create files, and drawings sync to the cloud (IndexedDB locally + D1/R2 remotely).

## Layout

- `apps/web` — TanStack Start (React, TS), Tailwind v4, shadcn via `@rhyme/ui`, tldraw canvas.
- `apps/api` — Hono on Cloudflare Workers. tRPC at `/trpc`, Better Auth at `/auth`, binary uploads (assets, thumbnails) as REST routes.
- Canvas assistant — `CanvasAgent` Durable Object (`@cloudflare/ai-chat`) in `apps/api/src/agents`, reached over WebSocket at `/files/:fileId/agent/chat` (editors only, one instance per file + user). Its tools have no `execute`: `apps/web/src/features/agent` applies them to the live tldraw editor, so edits save like user edits. Tool schemas in `canvas-schema.ts` are shared with the web app.
- `packages/db` — Drizzle schema + `createDb(d1)`. Migrations in `packages/db/migrations`.
- `packages/trpc-client` — tRPC client, `useTRPC`, router types (`FileSummary`, `Folder`, …).
- `packages/hooks` — `@rhyme/hooks/queries` (`useFiles`, `useFile`, …) and `@rhyme/hooks/mutations` (`useCreateFile`, …). Components consume data only through these.
- `packages/ui` — shadcn components (`@rhyme/ui/components/*`), theme provider, `globals.css`.

## Data model

- D1 holds metadata and relations: `users/sessions/accounts/verifications` (Better Auth), `folders` (self-nesting), `files`, `file_collaborators` (viewer/editor), `assets`.
- R2 holds content: `files/{id}/documents/{uuid}.json` (tldraw store snapshot), `files/{id}/assets/{id}`, `files/{id}/thumbnail`.
- Saves are optimistic: `files.saveDocument` writes a new R2 object, then updates D1 `WHERE version = baseVersion`; mismatch → `CONFLICT`.

## Commands

- `pnpm dev` — web on :3000, api on :8787.
- `pnpm db:generate` after schema changes, then `pnpm db:migrate` (local D1).
- `pnpm check-types`, `pnpm lint`, `pnpm build`.
- Local sign-in codes are printed in the `wrangler dev` output (`send_email` is simulated).
- The assistant runs on Workers AI (`AI` binding, model in the `AI_MODEL` var). Workers AI always calls Cloudflare, even in `wrangler dev`, so local dev needs `wrangler login`.

## Conventions

- pnpm only; shared versions live in the `catalog:` of `pnpm-workspace.yaml`.
- Access control lives in `apps/api/src/services/access.ts`; use `fileProcedure(role)` for file-scoped procedures.
- Add shadcn components from `apps/web`: `pnpm dlx shadcn@latest add <name>` (they land in `packages/ui`). Both configs use `base-nova`; preserve the shared theme and existing variant sizes.
- UI composition uses Base UI `render`, not `asChild`. Style navigation links with `buttonVariants`; use `@rhyme/ui/components/toast` for notifications.
- No comments unless essential; one short line when needed.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
