import { z } from 'zod'

const hasUnsafeCharacters = (value: string) =>
  [...value].some(
    (character) =>
      character === '\\' ||
      character.charCodeAt(0) <= 32 ||
      character.charCodeAt(0) === 127,
  )

export function safeAuthRedirect(value: unknown): string | undefined {
  if (
    typeof value !== 'string' ||
    value.length > 2048 ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    hasUnsafeCharacters(value)
  )
    return undefined
  try {
    const url = new URL(value, 'https://rhyme.invalid')
    const path = decodeURIComponent(url.pathname)
    if (
      url.origin !== 'https://rhyme.invalid' ||
      path.startsWith('//') ||
      hasUnsafeCharacters(path) ||
      ['/sign-in', '/auth/complete', '/onboarding'].includes(
        path.replace(/\/+$/, ''),
      )
    )
      return undefined
    return value
  } catch {
    return undefined
  }
}

export const authSearch = z.object({
  redirect: z.unknown().optional().transform(safeAuthRedirect),
})
