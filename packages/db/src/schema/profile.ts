import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { users } from './auth'
import { timestamp, timestamps } from './columns'

export const userProfiles = sqliteTable('user_profiles', {
  userId: text()
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: text(),
  useCases: text({ mode: 'json' }).$type<string[]>().notNull().default([]),
  teamSize: text(),
  referral: text(),
  analyticsConsent: integer({ mode: 'boolean' }).notNull().default(false),
  completedAt: timestamp().notNull(),
  ...timestamps(),
})
