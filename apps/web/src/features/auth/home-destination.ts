import type { FileSummary } from '@rhyme/trpc-client'

export function lastEditedCanvas(files: FileSummary[], userId: string) {
  return files
    .filter(
      (file) =>
        !file.trashedAt &&
        file.role !== 'viewer' &&
        file.lastEditedById === userId &&
        !file.id.startsWith('pending:'),
    )
    .sort(
      (first, second) => second.updatedAt.getTime() - first.updatedAt.getTime(),
    )[0]?.id
}
