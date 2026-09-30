import { relations } from 'drizzle-orm'
import { accounts, sessions, users } from './auth'
import { assets, fileCollaborators, files, folders } from './drawings'

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  folders: many(folders),
  files: many(files, { relationName: 'owner' }),
  collaborations: many(fileCollaborators, { relationName: 'collaborator' }),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}))

export const foldersRelations = relations(folders, ({ one, many }) => ({
  owner: one(users, { fields: [folders.ownerId], references: [users.id] }),
  parent: one(folders, {
    fields: [folders.parentId],
    references: [folders.id],
    relationName: 'tree',
  }),
  children: many(folders, { relationName: 'tree' }),
  files: many(files),
}))

export const filesRelations = relations(files, ({ one, many }) => ({
  owner: one(users, {
    fields: [files.ownerId],
    references: [users.id],
    relationName: 'owner',
  }),
  lastEditedBy: one(users, {
    fields: [files.lastEditedById],
    references: [users.id],
  }),
  folder: one(folders, { fields: [files.folderId], references: [folders.id] }),
  collaborators: many(fileCollaborators),
  assets: many(assets),
}))

export const fileCollaboratorsRelations = relations(
  fileCollaborators,
  ({ one }) => ({
    file: one(files, {
      fields: [fileCollaborators.fileId],
      references: [files.id],
    }),
    user: one(users, {
      fields: [fileCollaborators.userId],
      references: [users.id],
      relationName: 'collaborator',
    }),
  }),
)

export const assetsRelations = relations(assets, ({ one }) => ({
  file: one(files, { fields: [assets.fileId], references: [files.id] }),
  uploadedBy: one(users, {
    fields: [assets.uploadedById],
    references: [users.id],
  }),
}))
