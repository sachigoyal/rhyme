import { and, eq, inArray, sql } from 'drizzle-orm'
import { schema } from '@rhyme/db'
import type { Database, File, FileRole } from '@rhyme/db'

const { fileCollaborators, files, folders } = schema

const rank: Record<FileRole, number> = { viewer: 0, editor: 1, owner: 2 }

export const hasRole = (role: FileRole, required: FileRole) =>
  rank[role] >= rank[required]

export async function getOwnedFiles(
  db: Database,
  ids: string[],
  userId: string,
) {
  return db
    .select()
    .from(files)
    .where(
      and(
        eq(files.ownerId, userId),
        inArray(
          files.id,
          sql`(select value from json_each(${JSON.stringify(ids)}))`,
        ),
      ),
    )
}

export interface FileAccess {
  file: File
  role: FileRole
}

export async function getFileAccess(
  db: Database,
  fileId: string,
  userId: string,
): Promise<FileAccess | null> {
  const row = await db
    .select({ file: files, role: fileCollaborators.role })
    .from(files)
    .leftJoin(
      fileCollaborators,
      and(
        eq(fileCollaborators.fileId, files.id),
        eq(fileCollaborators.userId, userId),
      ),
    )
    .where(eq(files.id, fileId))
    .get()

  if (!row) return null
  if (row.file.ownerId === userId) return { file: row.file, role: 'owner' }
  return row.role ? { file: row.file, role: row.role } : null
}

export async function isFolderOwner(
  db: Database,
  folderId: string,
  userId: string,
) {
  const folder = await db
    .select({ id: folders.id })
    .from(folders)
    .where(and(eq(folders.id, folderId), eq(folders.ownerId, userId)))
    .get()
  return Boolean(folder)
}
