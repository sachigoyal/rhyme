import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { users } from './auth'

export const aiUsage = sqliteTable(
  'ai_usage',
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    period: text().notNull(),
    tokens: integer().notNull().default(0),
    leaseId: text(),
    leaseExpiresAt: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.period] })],
)
