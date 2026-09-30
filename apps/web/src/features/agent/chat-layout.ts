export const chatMessageLayouts = {
  panel: 'gap-4 px-3 py-4',
  workspace: 'mx-auto w-full max-w-3xl gap-4 px-3 py-4 sm:px-5 sm:py-5',
}

export const chatComposerLayouts = {
  panel: 'shrink-0',
  workspace: 'mx-auto w-full max-w-3xl shrink-0 px-1 pb-3 sm:px-3',
}

export type ChatLayout = keyof typeof chatMessageLayouts
