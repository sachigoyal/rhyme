import type { D1Database } from '@cloudflare/workers-types'
import { ProviderError } from './provider-errors'

export const FREE_AI_QUOTA_MESSAGE =
  'You’ve reached your free AI allowance for this month. Add your own API key and choose its model to keep chatting, or wait until next month (UTC).'

export function monthlyTokenLimit(value?: string) {
  if (value === undefined) return 100_000
  const limit = Number(value)
  if (!value.trim() || !Number.isSafeInteger(limit) || limit < 0)
    throw new Error('AI_MONTHLY_TOKEN_LIMIT must be a non-negative integer')
  return limit
}

export async function acquireAIQuota(
  db: D1Database,
  userId: string,
  limit: number,
  now = Date.now(),
) {
  const period = new Date(now).toISOString().slice(0, 7)
  const leaseId = crypto.randomUUID()
  await db
    .prepare(
      'INSERT INTO ai_usage (user_id, period) VALUES (?, ?) ON CONFLICT DO NOTHING',
    )
    .bind(userId, period)
    .run()
  const claimed = await db
    .prepare(
      'UPDATE ai_usage SET lease_id = ?, lease_expires_at = ? WHERE user_id = ? AND period = ? AND tokens < ? AND lease_expires_at <= ? RETURNING tokens',
    )
    .bind(leaseId, now + 180_000, userId, period, limit, now)
    .first<{ tokens: number }>()
  if (!claimed) {
    const usage = await db
      .prepare('SELECT tokens FROM ai_usage WHERE user_id = ? AND period = ?')
      .bind(userId, period)
      .first<{ tokens: number }>()
    if ((usage?.tokens ?? 0) >= limit)
      throw new ProviderError('free_quota', FREE_AI_QUOTA_MESSAGE)
    throw new ProviderError(
      'free_ai_busy',
      'A built-in AI response is already running in another chat. Wait for it to finish, or choose your own API key.',
    )
  }
  let charged = 0
  return {
    get exceeded() {
      return claimed.tokens + charged >= limit
    },
    check() {
      if (claimed.tokens + charged >= limit)
        throw new ProviderError('free_quota', FREE_AI_QUOTA_MESSAGE)
    },
    async charge(tokens: number) {
      const next = Math.max(charged, Math.ceil(tokens))
      await db
        .prepare(
          'UPDATE ai_usage SET tokens = tokens + ? WHERE user_id = ? AND period = ? AND lease_id = ?',
        )
        .bind(next - charged, userId, period, leaseId)
        .run()
      charged = next
    },
    async release() {
      await db
        .prepare(
          'UPDATE ai_usage SET lease_id = NULL, lease_expires_at = 0 WHERE user_id = ? AND period = ? AND lease_id = ?',
        )
        .bind(userId, period, leaseId)
        .run()
    },
  }
}
