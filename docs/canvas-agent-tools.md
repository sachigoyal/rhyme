# Canvas agent tooling

Rhyme exposes eight browser-executed tools. Schemas and tool descriptions live in
`apps/api/src/agents`; execution, context collection and layout live in
`apps/web/src/features/agent`. All edits use the live tldraw editor and its normal
save path. Deletion still requires user approval.

| Tool             | Use                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `read_canvas`    | Read selection, IDs, regions, text/type matches or the paginated page; request full typography and connector properties when needed. |
| `create_diagram` | Create semantic nodes and labelled edges with measured text, flow/grid/stack layout, and placement that avoids existing content.     |
| `create_shapes`  | Precisely position geometry, text, notes or arrows for illustrations and custom compositions.                                        |
| `update_shapes`  | Apply individual edits or one shared patch to many IDs, including relative movement, typography and separate label/body colors.      |
| `arrange_shapes` | Align, distribute, pack, or lay out existing nodes using their arrow relationships.                                                  |
| `connect_shapes` | Create bound relationships or rebind an existing `arrowId`; control labels, anchor points, bends, dash and arrowheads.               |
| `inspect_scene`  | Check bodies, spacing, connector crossings and likely label contrast issues; inspect relationships around focused IDs.               |
| `delete_shapes`  | Delete approved, unlocked shapes.                                                                                                    |

## Context and token balance

The initial live snapshot includes up to 500 shapes, selected shapes first, with
complete labels, geometry, hierarchy, useful styles and connections. Whole-page
counts, bounds and up to 32 offscreen clusters provide peripheral awareness.
Snapshots use a 100,000-character shape budget. Reads default to 300 shapes and
160,000 characters, configurable up to 1,000 shapes and 500,000 characters.
These are character budgets, not exact token counts. A single oversized shape is
still returned intact so pagination always progresses. Follow `nextOffset`;
`offscreen` and `omitted` have different meanings.

Labels are never shortened in shape descriptions. Cluster example labels are
excerpts. Use ID/selection/region reads and full detail for focused work rather
than repeatedly loading the entire page. Mutation results return actual shape
geometry; higher-level scene creation/layout also return diagnostics.

The browser refreshes structured context and, for vision models, a viewport
image before submitting a tool result. The server uses that snapshot only after
its corresponding result exists in the current user turn. Older snapshots cannot
leak into a new turn or regeneration. Snapshots are stored separately from the
transcript, avoiding repeated image/base64 blobs inside tool results. Text-only
models still receive all structured context.

## Layout and relationships

Semantic roles supply overridable shape/color defaults. Flow layout uses ELK in
a lazily loaded Web Worker; grid and stack use deterministic cell sizes. Text is
measured with tldraw's current theme and font settings. Diagram placement avoids
existing bodies by default. Long default connectors that intersect unrelated
nodes are routed as curves when a clear sampled path can be found. Explicit kind
or bend overrides are preserved. Auto-routed connectors are reconsidered when
their nodes are arranged.

This is not a general obstacle-free edge-routing guarantee. Diagnostics use page
bounding boxes and sampled connector geometry; intentional artwork overlap,
connector-to-connector crossings and unusual fonts still need visual review.
Groups/frames are described but are not created by these tools. Flow layout does
not support self-loops; model feedback with a separate node. Layout is capped at
15 seconds and detects changes to its input shapes while it calculates.

## Validation

Run `pnpm test`, `pnpm check-types`, `pnpm lint`, and `pnpm build`.
Run real-editor regression scenarios with:

```sh
PLAYWRIGHT_CHANNEL=chrome pnpm --filter web exec node --test tests/canvas-agent.browser.mjs
```

Omit the channel when Playwright Chromium is installed. Set
`CANVAS_SCREENSHOT_DIR` to save a visual review image. Scenarios cover branching,
cycles, multilingual labels, large grids, pagination, bulk styling, rotated
parents, locks, live bindings, connector rebinding, replay and undo.

These tests measure tool correctness, not live-model task success. Compare fixed
models and starting snapshots on representative user tasks before claiming
productivity or token savings. Record completion, user corrections, unintended
edits, visual quality, input/output tokens, latency, calls and recovery.

## Research references

- [tldraw's agent starter kit](https://tldraw.dev/starter-kits/agent): focused context, peripheral clusters and multi-shape actions.
- [ELK JavaScript](https://github.com/kieler/elkjs): layered graph layout and browser workers.
- [Writing effective tools](https://www.anthropic.com/engineering/writing-tools-for-agents): workflow-oriented tools, meaningful results and task evaluations.
- [Context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents): retain useful context and retrieve additional detail when needed.
