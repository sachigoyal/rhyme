import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { users } from './auth'
import { createdAt, id, timestamp, timestamps } from './columns'

export const collaboratorRoles = ['viewer', 'editor'] as const
export type CollaboratorRole = (typeof collaboratorRoles)[number]
export type FileRole = 'owner' | CollaboratorRole

export const folders = sqliteTable(
  'folders',
  {
    id: id(),
    ownerId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    parentId: text().references((): AnySQLiteColumn => folders.id, {
      onDelete: 'cascade',
    }),
    name: text().notNull(),
    ...timestamps(),
  },
  (t) => [index('folders_owner_parent_idx').on(t.ownerId, t.parentId)],
)

// Canvas content lives in R2 under `documentKey`; `version` guards concurrent saves.
export const files = sqliteTable(
  'files',
  {
    id: id(),
    ownerId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    folderId: text().references(() => folders.id, { onDelete: 'set null' }),
    name: text().notNull(),
    documentKey: text(),
    documentSize: integer().notNull().default(0),
    version: integer().notNull().default(0),
    thumbnailKey: text(),
    lastEditedById: text().references(() => users.id, {
      onDelete: 'set null',
    }),
    trashedAt: timestamp(),
    ...timestamps(),
  },
  (t) => [
    index('files_owner_folder_idx').on(t.ownerId, t.folderId),
    index('files_owner_updated_idx').on(t.ownerId, t.updatedAt),
  ],
)

export const fileCollaborators = sqliteTable(
  'file_collaborators',
  {
    fileId: text()
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text({ enum: collaboratorRoles }).notNull().default('viewer'),
    invitedById: text().references(() => users.id, { onDelete: 'set null' }),
    ...timestamps(),
  },
  (t) => [
    primaryKey({ columns: [t.fileId, t.userId] }),
    index('file_collaborators_user_idx').on(t.userId),
  ],
)

export const assets = sqliteTable(
  'assets',
  {
    id: id(),
    fileId: text()
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    uploadedById: text().references(() => users.id, { onDelete: 'set null' }),
    key: text().notNull().unique(),
    name: text().notNull(),
    mimeType: text().notNull(),
    size: integer().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('assets_file_idx').on(t.fileId)],
)
