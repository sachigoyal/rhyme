import { integer, text } from 'drizzle-orm/sqlite-core'

export const id = () =>
  text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID())

export const timestamp = () => integer({ mode: 'timestamp_ms' })

export const createdAt = () =>
  timestamp()
    .notNull()
    .$defaultFn(() => new Date())

export const timestamps = () => ({
  createdAt: createdAt(),
  updatedAt: timestamp()
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
})
