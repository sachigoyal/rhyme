import { drizzle } from 'drizzle-orm/d1'
import type { AnyD1Database } from 'drizzle-orm/d1'
import * as schema from './schema'

export function createDb(d1: AnyD1Database) {
  return drizzle(d1, { schema, casing: 'snake_case' })
}

export type Database = ReturnType<typeof createDb>

export type File = typeof schema.files.$inferSelect
export type Folder = typeof schema.folders.$inferSelect
export type Asset = typeof schema.assets.$inferSelect
export type User = typeof schema.users.$inferSelect

export { schema }
export { collaboratorRoles } from './schema'
export type { CollaboratorRole, FileRole } from './schema'
