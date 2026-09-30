import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTRPC } from '@rhyme/trpc-client'
import type { FileSummary, Folder } from '@rhyme/trpc-client'
import {
  pendingId,
  readCacheBase,
  replaceFileInList,
  useFilesCache,
} from '../cache'

const sortFolders = (rows: Folder[]) =>
  [...rows].sort((a, b) => a.name.localeCompare(b.name))

function useFoldersCache() {
  const trpc = useTRPC()
  const cache = useFilesCache()
  return {
    ...cache,
    folderUpdate: (update: (rows: Folder[]) => Folder[]) => ({
      filter: trpc.folders.list.queryFilter(),
      update: (data: unknown) => data && update(data as Folder[]),
    }),
    folderInvalidation: {
      scope: 'folders',
      filter: trpc.folders.list.queryFilter(),
    },
  }
}

export function useCreateFolder() {
  const trpc = useTRPC()
  const cache = useFoldersCache()
  return useMutation(
    trpc.folders.create.mutationOptions({
      onMutate: async (input) => {
        const folder: Folder = {
          id: pendingId(),
          name: input.name.trim(),
          parentId: input.parentId ?? null,
          createdAt: new Date(),
        }
        const transaction = await cache.begin(
          ['folders'],
          [
            cache.folderUpdate((rows) =>
              sortFolders([
                ...rows.filter((row) => row.id !== folder.id),
                folder,
              ]),
            ),
          ],
        )
        return { transaction, folder }
      },
      onSuccess: (saved, _input, context) => {
        if (!saved || !context) return
        Object.assign(context.folder, saved)
        cache.refresh(context.transaction)
      },
      onError: (_error, _input, context) =>
        cache.rollback(context?.transaction),
      onSettled: (_data, _error, _input, context) =>
        cache.settle(context?.transaction, [cache.folderInvalidation]),
    }),
  )
}

export function useRenameFolder() {
  const trpc = useTRPC()
  const cache = useFoldersCache()
  return useMutation(
    trpc.folders.rename.mutationOptions({
      onMutate: ({ id, name }) =>
        cache.begin(
          ['folders'],
          [
            cache.folderUpdate((rows) =>
              sortFolders(
                rows.map((folder) =>
                  folder.id === id ? { ...folder, name: name.trim() } : folder,
                ),
              ),
            ),
          ],
        ),
      onError: (_error, _input, transaction) => cache.rollback(transaction),
      onSettled: (_data, _error, _input, transaction) =>
        cache.settle(transaction, [cache.folderInvalidation]),
    }),
  )
}

export function useDeleteFolder() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const cache = useFoldersCache()
  return useMutation(
    trpc.folders.delete.mutationOptions({
      onMutate: async ({ id }) => {
        await Promise.all([
          queryClient.cancelQueries(trpc.folders.list.queryFilter()),
          queryClient.cancelQueries(cache.lists),
          queryClient.cancelQueries(trpc.files.get.queryFilter()),
        ])
        const folders =
          queryClient.getQueryData(trpc.folders.list.queryKey()) ?? []
        const removed = new Set([id])
        let changed = true
        while (changed) {
          changed = false
          for (const folder of folders) {
            if (
              folder.parentId &&
              removed.has(folder.parentId) &&
              !removed.has(folder.id)
            ) {
              removed.add(folder.id)
              changed = true
            }
          }
        }
        const listed = queryClient
          .getQueriesData<FileSummary[]>(cache.lists)
          .flatMap(([key, rows]) => [
            ...(rows ?? []),
            ...(readCacheBase<FileSummary[]>(queryClient, key) ?? []),
          ])
        const details = queryClient
          .getQueriesData<FileSummary>(trpc.files.get.queryFilter())
          .flatMap(([key, data]) => [
            data,
            readCacheBase<FileSummary>(queryClient, key),
          ])
          .filter((file): file is FileSummary => !!file)
        const affected = [
          ...new Map(
            [...listed, ...details]
              .filter((file) => file.folderId && removed.has(file.folderId))
              .map((file) => [file.id, file]),
          ).values(),
        ]
        for (const file of affected) {
          if (
            !queryClient.getQueryData(trpc.files.get.queryKey({ id: file.id }))
          )
            queryClient.setQueryData(
              trpc.files.get.queryKey({ id: file.id }),
              file,
            )
        }
        const rehome = (file: FileSummary) =>
          file.folderId && removed.has(file.folderId)
            ? { ...file, folderId: null }
            : file
        const transaction = await cache.begin(
          ['folders', 'files'],
          [
            cache.folderUpdate((rows) =>
              rows.filter((folder) => !removed.has(folder.id)),
            ),
            {
              filter: trpc.files.get.queryFilter(),
              update: (data) => data && rehome(data as FileSummary),
            },
            cache.listUpdate((rows, key) => {
              let next = rows
              for (const source of affected) {
                const file = cache.find(source.id) ?? source
                next = replaceFileInList(next, rehome(file), key)
              }
              return next
            }),
          ],
        )
        return { transaction, affectedIds: affected.map((file) => file.id) }
      },
      onError: (_error, _input, context) =>
        cache.rollback(context?.transaction),
      onSettled: (_data, _error, _input, context) =>
        cache.settle(context?.transaction, [
          cache.folderInvalidation,
          cache.listInvalidation,
          ...(context?.affectedIds ?? []).map(cache.fileInvalidation),
        ]),
    }),
  )
}
