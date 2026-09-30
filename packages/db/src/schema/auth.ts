import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { timestamp, timestamps } from './columns'

export const users = sqliteTable('users', {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: integer({ mode: 'boolean' }).notNull().default(false),
  image: text(),
  ...timestamps(),
})

export const sessions = sqliteTable(
  'sessions',
  {
    id: text().primaryKey(),
    token: text().notNull().unique(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp().notNull(),
    ipAddress: text(),
    userAgent: text(),
    ...timestamps(),
  },
  (t) => [index('sessions_user_id_idx').on(t.userId)],
)

export const accounts = sqliteTable(
  'accounts',
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text().notNull(),
    providerId: text().notNull(),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp(),
    refreshTokenExpiresAt: timestamp(),
    scope: text(),
    password: text(),
    ...timestamps(),
  },
  (t) => [index('accounts_user_id_idx').on(t.userId)],
)

export const verifications = sqliteTable(
  'verifications',
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp().notNull(),
    ...timestamps(),
  },
  (t) => [index('verifications_identifier_idx').on(t.identifier)],
)
