Welcome to your new TanStack Start app!

# Getting Started

To run this application:

```bash
pnpm install
pnpm dev
```

# Building For Production

To build this application for production:

```bash
pnpm build
```

## Styling

This project uses [Tailwind CSS](https://tailwindcss.com/) for styling.

Shared UI lives in `packages/ui`. Both shadcn configurations use `base-nova`, so future additions use Base UI. Install from `apps/web` with `pnpm dlx shadcn@latest add <name>` and preserve the shared theme tokens, Nova layouts, and existing button sizes.

The migration replaces primitives inside the shared wrappers, then updates consumers to their Base UI contracts:

| Area                                                                       | Implementation                            | Consumer changes                                                                                        |
| -------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Buttons, inputs, avatars, switches, separators, scrolling                  | Base UI primitives with existing styles   | Explicit submit buttons; existing scroll viewport customization retained                                |
| Badges, breadcrumbs, markers, sidebar composition                          | Base UI `useRender`                       | `render` replaces `asChild`; navigation remains a semantic link                                         |
| Select                                                                     | Base UI Root, Positioner, Popup and List  | Supply `items` label mappings so selected labels display before opening                                 |
| Dialog, alert dialog, sheet                                                | Base UI Dialog / AlertDialog              | Controlled async confirmation closes only on success; ordinary action buttons close explicitly          |
| Dropdown, popover, tooltip, hover card                                     | Menu, Popover, Tooltip and PreviewCard    | `render` composition, item `onClick`, group labels inside groups, `finalFocus` for composer restoration |
| Toasts                                                                     | Base UI global manager and app provider   | Import `toast` from `@rhyme/ui/components/toast`; trash Undo remains supported                          |
| Cards, skeletons, textareas, input groups, OTP, resizable panels, messages | Existing native or independent components | Already compatible with the Base shadcn registry; retain their established APIs                         |

Popup position and animation styles use Base UI variables (`--available-height`, `--anchor-width`, `--transform-origin`) and state attributes. Colors, radii, typography, spacing and button variants remain in the shared CSS and wrappers. Keep `DropdownMenuLabel` within `DropdownMenuGroup`, and distinguish ordinary dismissible dialogs from alert dialogs that reject outside clicks. Async delete confirmations keep pending/error state visible and block dismissal while pending. The app content uses an isolated stacking context, while dialog backdrops and the positioned body follow Base UI’s Safari setup.

Base UI tooltips are visual hints; keep an accessible name on each trigger, including icon buttons and disabled-action wrappers.

Radio and checkbox menu items close on selection to preserve the previous behavior. Trash and restore notifications await mutation promises so optimistic card removal cannot suppress the success toast or Undo action.

Style TanStack `Link` and plain anchors with `buttonVariants` instead of rendering links through Base UI Button, which applies button semantics. Toasts share one manager and provider, with keyboard access, swipe dismissal, timeout pausing on hover/focus, and reduced-motion support.

`tldraw` still depends internally on Radix UI. Its own canvas controls remain upstream-owned; the application and shared shadcn components no longer import Radix or Sonner.

API references: [shadcn Base button](https://ui.shadcn.com/docs/components/base/button), [Base UI composition](https://base-ui.com/react/handbook/composition), [Dialog](https://base-ui.com/react/components/dialog), [Alert Dialog](https://base-ui.com/react/components/alert-dialog), [Toast](https://base-ui.com/react/components/toast).

### Removing Tailwind CSS

If you prefer not to use Tailwind CSS:

1. Remove the demo pages in `src/routes/demo/`
2. Replace the Tailwind import in `src/styles.css` with your own styles
3. Remove `tailwindcss()` from the plugins array in `vite.config.ts`
4. Remove `@tailwindcss/vite` and `tailwindcss` from `package.json`

## Linting & Formatting

This project uses [Oxlint](https://oxc.rs/docs/guide/usage/linter) and [Oxfmt](https://oxc.rs/docs/guide/usage/formatter), configured at the repository root. Run these commands from the root to check every workspace:

```bash
pnpm lint
pnpm format
pnpm format:check
```

## Testing

Run unit tests with `pnpm --filter web test`. The separate Base UI browser suite
uses actual shared wrappers and application dialogs in an isolated Vite fixture,
so it needs no authentication or API server:

```sh
pnpm --filter web exec playwright install chromium
pnpm --filter web test:ui
```

Use `PLAYWRIGHT_CHANNEL=chrome pnpm --filter web test:ui` with an installed Google
Chrome. The suite checks dialog focus and async confirmation, nested select
portals, composed tooltip/menu triggers, semantic navigation links, mobile
sheets, toast Undo, scrollbar sizing, and light/dark brand styles. See
[`tests/README.md`](tests/README.md) for details.

## Routing

This project uses [TanStack Router](https://tanstack.com/router) with file-based routing. Routes are managed as files in `src/routes`.

### Adding A Route

To add a new route to your application just add a new file in the `./src/routes` directory.

TanStack will automatically generate the content of the route file for you.

Now that you have two routes you can use a `Link` component to navigate between them.

### Adding Links

To use SPA (Single Page Application) navigation you will need to import the `Link` component from `@tanstack/react-router`.

```tsx
import { Link } from '@tanstack/react-router'
```

Then anywhere in your JSX you can use it like so:

```tsx
<Link to="/about">About</Link>
```

This will create a link that will navigate to the `/about` route.

More information on the `Link` component can be found in the [Link documentation](https://tanstack.com/router/v1/docs/framework/react/api/router/linkComponent).

### Using A Layout

In the File Based Routing setup the layout is located in `src/routes/__root.tsx`. Anything you add to the root route will appear in all the routes. The route content will appear in the JSX where you render `{children}` in the `shellComponent`.

Here is an example layout that includes a header:

```tsx
import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'My App' },
    ],
  }),
  shellComponent: ({ children }) => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <header>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
          </nav>
        </header>
        {children}
        <Scripts />
      </body>
    </html>
  ),
})
```

More information on layouts can be found in the [Layouts documentation](https://tanstack.com/router/latest/docs/framework/react/guide/routing-concepts#layouts).

## Server Functions

TanStack Start provides server functions that allow you to write server-side code that seamlessly integrates with your client components.

```tsx
import { createServerFn } from '@tanstack/react-start'

const getServerTime = createServerFn({
  method: 'GET',
}).handler(async () => {
  return new Date().toISOString()
})

// Use in a component
function MyComponent() {
  const [time, setTime] = useState('')

  useEffect(() => {
    getServerTime().then(setTime)
  }, [])

  return <div>Server time: {time}</div>
}
```

## API Routes

You can create API routes by using the `server` property in your route definitions:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/api/hello')({
  server: {
    handlers: {
      GET: () => json({ message: 'Hello, World!' }),
    },
  },
})
```

## Data Fetching

There are multiple ways to fetch data in your application. You can use TanStack Query to fetch data from a server. But you can also use the `loader` functionality built into TanStack Router to load the data for a route before it's rendered.

For example:

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/people')({
  loader: async () => {
    const response = await fetch('https://swapi.dev/api/people')
    return response.json()
  },
  component: PeopleComponent,
})

function PeopleComponent() {
  const data = Route.useLoaderData()
  return (
    <ul>
      {data.results.map((person) => (
        <li key={person.name}>{person.name}</li>
      ))}
    </ul>
  )
}
```

Loaders simplify your data fetching logic dramatically. Check out more information in the [Loader documentation](https://tanstack.com/router/latest/docs/framework/react/guide/data-loading#loader-parameters).

# Learn More

You can learn more about all of the offerings from TanStack in the [TanStack documentation](https://tanstack.com).

For TanStack Start specific documentation, visit [TanStack Start](https://tanstack.com/start).
