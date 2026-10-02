export const SEO_IMAGE_VERSION = 2

export interface SeoPage {
  id: string
  path: string
  title: string
  description: string
  imageTitle: readonly string[]
  imageDescription: string
  imageAlt: string
  indexable?: boolean
}

export const seoPages = {
  home: {
    id: 'home',
    path: '/',
    title: 'Rhyme — Online whiteboard with a canvas assistant',
    description:
      'Draw diagrams, organize ideas, and add images on an infinite canvas. Save your work, share viewer or editor access, and edit shapes with Rhyme.',
    imageTitle: ['Online whiteboard.', 'Rhyme.'],
    imageDescription: 'Draw diagrams. Share canvases. Edit with the assistant.',
    imageAlt:
      'Rhyme online whiteboard with connected shapes and a canvas assistant',
    indexable: true,
  },
  signIn: {
    id: 'sign-in',
    path: '/sign-in',
    title: 'Sign in · Rhyme',
    description:
      'Sign in to Rhyme or create an account with an email verification code. Save canvases, share access, and use the canvas assistant.',
    imageTitle: ['Sign in to Rhyme.'],
    imageDescription: 'Save canvases and access your workspace.',
    imageAlt: 'Rhyme sign-in preview with an email verification form',
  },
  privacy: {
    id: 'privacy',
    path: '/privacy',
    title: 'Privacy policy · Rhyme',
    description:
      'How Rhyme, a personal learning project, handles sign-in details, drawings, browser storage, and AI conversations.',
    imageTitle: ['Your privacy.'],
    imageDescription: 'How this personal learning project handles your data.',
    imageAlt: 'Rhyme privacy policy preview',
    indexable: true,
  },
  terms: {
    id: 'terms',
    path: '/terms',
    title: 'Terms of Service · Rhyme',
    description:
      'Simple expectations for using Rhyme, an experimental personal whiteboard project built for learning.',
    imageTitle: ['A learning project.'],
    imageDescription: 'Simple expectations for using Rhyme.',
    imageAlt: 'Rhyme Terms of Service preview',
    indexable: true,
  },
  onboarding: {
    id: 'onboarding',
    path: '/onboarding',
    title: 'Account setup · Rhyme',
    description:
      'Set up your Rhyme profile, add optional work details, and choose your usage analytics preference.',
    imageTitle: ['Set up your account.'],
    imageDescription: 'Add profile details and choose your preferences.',
    imageAlt: 'Rhyme account setup preview with profile fields',
  },
  authComplete: {
    id: 'auth-complete',
    path: '/auth/complete',
    title: 'Completing sign-in · Rhyme',
    description: 'Complete sign-in and open your Rhyme workspace.',
    imageTitle: ['Your Rhyme workspace.'],
    imageDescription: 'Canvases, conversations, and the canvas assistant.',
    imageAlt: 'Rhyme workspace preview with canvas cards',
  },
  files: {
    id: 'canvases',
    path: '/files',
    title: 'Canvases · Rhyme',
    description:
      'Create, search, and organize your Rhyme canvases in folders. Open drawings, manage shared access, and restore canvases from trash.',
    imageTitle: ['Your canvases.'],
    imageDescription: 'Create, search, and organize your work.',
    imageAlt: 'Rhyme canvases preview with folders and a grid of drawings',
  },
  shared: {
    id: 'shared',
    path: '/files?view=shared',
    title: 'Shared with me · Rhyme',
    description:
      'Open Rhyme canvases shared with your account. View drawings or edit them according to the access granted by each owner.',
    imageTitle: ['Shared canvases.'],
    imageDescription: 'Open the canvases shared with your account.',
    imageAlt: 'Rhyme shared canvases preview with viewer and editor access',
  },
  trash: {
    id: 'trash',
    path: '/files?view=trash',
    title: 'Trash · Rhyme',
    description:
      'Review deleted Rhyme canvases. Restore a canvas or permanently delete it and its assets.',
    imageTitle: ['Deleted canvases.'],
    imageDescription: 'Restore canvases or delete them permanently.',
    imageAlt: 'Rhyme trash preview with a canvas restore action',
  },
  canvas: {
    id: 'canvas',
    path: '/files',
    title: 'Canvas · Rhyme',
    description:
      'Open a Rhyme canvas to draw, add images or videos, and organize work across pages. Canvas access is managed by its owner.',
    imageTitle: ['Open a canvas.'],
    imageDescription: 'Draw, add media, and edit shapes across pages.',
    imageAlt: 'Rhyme canvas preview with connected shapes and drawing tools',
  },
  chats: {
    id: 'conversations',
    path: '/chats',
    title: 'Conversations · Rhyme',
    description:
      'Review your Rhyme conversations, view messages and saved canvas changes, or continue a conversation.',
    imageTitle: ['Canvas conversations.'],
    imageDescription: 'Review messages and continue canvas edits.',
    imageAlt:
      'Rhyme conversations preview with assistant messages and canvas changes',
  },
  activity: {
    id: 'activity',
    path: '/activity',
    title: 'Agent activity · Rhyme',
    description:
      'Review Rhyme usage across your canvases, including agent runs, canvas actions, token usage, and average run time.',
    imageTitle: ['Agent activity.'],
    imageDescription: 'Usage and performance across your canvases.',
    imageAlt: 'Rhyme agent activity preview with usage and performance metrics',
  },
  settings: {
    id: 'settings',
    path: '/settings',
    title: 'Settings · Rhyme',
    description:
      'Manage your Rhyme profile, appearance, home page, canvas defaults, and usage analytics preference.',
    imageTitle: ['Workspace settings.'],
    imageDescription:
      'Manage appearance, account details, and canvas preferences.',
    imageAlt: 'Rhyme settings preview with workspace preference controls',
  },
  notFound: {
    id: 'not-found',
    path: '/',
    title: 'Page not found · Rhyme',
    description:
      'This page does not exist. Check the URL or return to your Rhyme canvases.',
    imageTitle: ['Page not found.'],
    imageDescription: 'Check the URL or return to your canvases.',
    imageAlt: 'Rhyme page not found preview with a canvas outline',
  },
} as const satisfies Record<string, SeoPage>

export function getSeoPage(href: string): SeoPage {
  const url = new URL(href, 'https://rhyme.invalid')
  const path = url.pathname.replace(/\/+$/, '') || '/'
  if (path === '/') return seoPages.home
  if (path === '/files') {
    if (url.searchParams.get('view') === 'shared') return seoPages.shared
    if (url.searchParams.get('view') === 'trash') return seoPages.trash
    return seoPages.files
  }
  if (/^\/files\/[^/]+$/.test(path)) return seoPages.canvas
  return (
    Object.values(seoPages).find((page) => page.path === path) ??
    seoPages.notFound
  )
}

export function normalizeSiteUrl(value: string) {
  const url = new URL(value)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (
    (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new Error(
      'VITE_SITE_URL must be an HTTPS origin, or localhost for development.',
    )
  return url.origin
}

export function canIndexSite(siteUrl: string, allowIndexing = true) {
  return (
    allowIndexing &&
    !['localhost', '127.0.0.1', '[::1]'].includes(new URL(siteUrl).hostname)
  )
}

export function createSeoHead(
  page: SeoPage,
  siteUrl: string,
  allowIndexing = true,
) {
  const origin = normalizeSiteUrl(siteUrl)
  const url = new URL(page.path, origin).href
  const image = new URL(`/og/${page.id}.png?v=${SEO_IMAGE_VERSION}`, origin)
    .href
  const indexable = Boolean(
    page.indexable && canIndexSite(origin, allowIndexing),
  )
  return {
    meta: [
      { title: page.title },
      { name: 'description', content: page.description },
      {
        name: 'robots',
        content: indexable
          ? 'index, follow, max-image-preview:large'
          : 'noindex, follow',
      },
      { name: 'application-name', content: 'Rhyme' },
      { name: 'theme-color', content: '#ffffff' },
      { name: 'color-scheme', content: 'light dark' },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'Rhyme' },
      { property: 'og:locale', content: 'en_US' },
      { property: 'og:title', content: page.title },
      { property: 'og:description', content: page.description },
      { property: 'og:url', content: url },
      { property: 'og:image', content: image },
      ...(origin.startsWith('https:')
        ? [{ property: 'og:image:secure_url', content: image }]
        : []),
      { property: 'og:image:type', content: 'image/png' },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: page.imageAlt },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: page.title },
      { name: 'twitter:description', content: page.description },
      { name: 'twitter:image', content: image },
      { name: 'twitter:image:alt', content: page.imageAlt },
      ...(page.id === 'home' && indexable
        ? [
            {
              'script:ld+json': {
                '@context': 'https://schema.org',
                '@graph': [
                  {
                    '@type': 'WebSite',
                    '@id': `${origin}/#website`,
                    name: 'Rhyme',
                    url: `${origin}/`,
                    inLanguage: 'en',
                  },
                  {
                    '@type': 'WebApplication',
                    '@id': `${origin}/#app`,
                    name: 'Rhyme',
                    url: `${origin}/`,
                    description: page.description,
                    applicationCategory: 'DesignApplication',
                    operatingSystem: 'Web browser',
                    image,
                  },
                ],
              },
            },
          ]
        : []),
    ],
    links: page.indexable ? [{ rel: 'canonical', href: url }] : [],
  }
}
