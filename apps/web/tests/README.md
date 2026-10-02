# Tests

Run unit tests with `pnpm --filter web test`.

The Base UI browser suite uses actual shared components, the application name
and confirmation dialogs, and the application Tailwind styles in an isolated
Vite fixture. It does not require the API, authentication, or production data.

Install Chromium once, then run the suite:

```sh
pnpm --filter web exec playwright install chromium
pnpm --filter web test:ui
```

An installed Google Chrome can also run the suite:

```sh
PLAYWRIGHT_CHANNEL=chrome pnpm --filter web test:ui
```

The suite covers menu-to-dialog focus and dismissal, asynchronous destructive
confirmation and retry, select labels before opening and keyboard selection,
tooltip/menu trigger composition, toast Undo, and constrained scroll sizing.
It also covers semantic navigation links, nested select portals, composer focus,
mobile sheets, and preserved light/dark button dimensions and brand colors.
Keyboard submenu radio selection also verifies all menu layers close and return focus.
Popover dismissal, hover previews, and switch pointer/keyboard state are covered too.

Set `UI_SCREENSHOT_DIR` to an existing directory to save desktop/light and
mobile/dark screenshots from the brand-style test.

## Canvas agent tools

`canvas-agent.browser.mjs` runs the actual tldraw editor and ELK worker without
API authentication. It verifies complex graph creation, grids, bulk styling,
page pagination, preserved labels, rotated groups, locks, live connectors,
rebinding, diagnostics, duplicate execution and undo. It runs with `test:ui`,
or independently:

```sh
PLAYWRIGHT_CHANNEL=chrome pnpm --filter web exec node --test tests/canvas-agent.browser.mjs
```

Set `CANVAS_SCREENSHOT_DIR` to save a complex-scene screenshot. Tool schemas,
context budgets and limitations are documented in `docs/canvas-agent-tools.md`.

## Authentication

`auth-flow.browser.mjs` runs the real application routes against mocked auth and
tRPC responses. It covers existing and new accounts, OTP, guest import success
and retry, account switching, empty drafts, onboarding, expired sessions, and
redirect destinations with search parameters and hashes. No account or API is
required. Run it with `test:ui`, or independently:

```sh
PLAYWRIGHT_CHANNEL=chrome pnpm --filter web exec node --test tests/auth-flow.browser.mjs
```

To run the same auth cases against the production build after `pnpm build`, add
`AUTH_TEST_BUILD=1` to that command. API calls are mocked for both configured
local and production origins; only tldraw CDN assets may load externally.
