export const DEFAULT_CONVERSATION_TITLE = 'New conversation'

export function canGenerateConversationTitle({
  source,
  title,
  promptTitle,
}: {
  source: 'pending' | 'generating' | 'generated' | 'manual'
  title: string
  promptTitle: string
}) {
  return (
    source === 'pending' &&
    Boolean(promptTitle) &&
    (title === DEFAULT_CONVERSATION_TITLE || title === promptTitle)
  )
}

export function normalizeConversationTitle(text: string) {
  const line =
    text
      .trim()
      .split('\n')
      .find((value) => value.trim()) ?? ''
  return line
    .replace(/^title:\s*/i, '')
    .replace(/^["'“‘`#*\s]+|["'”’`*\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .split(' ')
    .slice(0, 7)
    .join(' ')
    .slice(0, 60)
    .replace(/[.!?:;,\s]+$/, '')
    .trim()
}

export function fallbackConversationTitle(prompt: string) {
  const subject = prompt
    .trim()
    .replace(
      /^(?:please\s+|can you\s+|could you\s+|i want (?:you to\s+|to\s+))+/i,
      '',
    )
  const title = normalizeConversationTitle(subject)
  return title
    ? title[0]!.toUpperCase() + title.slice(1)
    : DEFAULT_CONVERSATION_TITLE
}
