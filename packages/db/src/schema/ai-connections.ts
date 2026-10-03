import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { users } from './auth'
import { id, timestamps } from './columns'

export const aiConnections = sqliteTable('ai_connections', {
  id: id(),
  userId: text()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  provider: text({
    enum: ['openai', 'anthropic', 'google', 'compatible'],
  }).notNull(),
  baseUrl: text().notNull().default(''),
  models: text({ mode: 'json' }).$type<string[]>().notNull(),
  vision: integer({ mode: 'boolean' }).notNull().default(false),
  serviceTier: text({ enum: ['standard', 'ultrafast'] })
    .notNull()
    .default('standard'),
  encryptedApiKey: text().notNull(),
  keyHint: text().notNull(),
  ...timestamps(),
})
