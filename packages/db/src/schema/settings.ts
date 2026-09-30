import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { users } from './auth'
import { files } from './drawings'
import { timestamps } from './columns'

export const userSettings = sqliteTable('user_settings', {
  userId: text()
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  lastEditedCanvasId: text().references(() => files.id, {
    onDelete: 'set null',
  }),
  homeDestination: text({ enum: ['dashboard', 'last-edited'] })
    .notNull()
    .default('dashboard'),
  theme: text({ enum: ['light', 'dark', 'system'] })
    .notNull()
    .default('system'),
  showGrid: integer({ mode: 'boolean' }).notNull().default(false),
  snapToShapes: integer({ mode: 'boolean' }).notNull().default(false),
  openAssistant: integer({ mode: 'boolean' }).notNull().default(false),
  ...timestamps(),
})
