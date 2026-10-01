import { useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { errorCode, useTRPC } from '@rhyme/trpc-client'
import type {
  ChatDetail,
  ChatSummary,
  FileSummary,
  RouterOutputs,
} from '@rhyme/trpc-client'
import {
  patchCache,
  pendingId,
  replaceFileInList,
  sessionUser,
  useFilesCache,
} from '../cache'
import type { CacheUpdate } from '../cache'

export function useCreateFile() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const cache = useFilesCache()
  return useMutation(
    trpc.files.create.mutationOptions({
      onMutate: async (input) => {
        const now = new Date()
        const file: FileSummary = {
          id: pendingId(),
          name: input?.name?.trim() || 'Untitled',
          folderId: input?.folderId ?? null,
          version: 0,
          lastEditedById: null,
          hasThumbnail: false,
          createdAt: now,
          updatedAt: now,
          trashedAt: null,
          owner: sessionUser(queryClient) ?? { id: '', name: 'You', email: '' },
          role: 'owner',
        }
        const transaction = await cache.begin(
          ['files'],
          [cache.listUpdate((rows, key) => replaceFileInList(rows, file, key))],
        )
        return { transaction, file }
      },
      onSuccess: (saved, _input, context) => {
        if (!saved || !context) return
        Object.assign(context.file, saved)
        cache.refresh(context.transaction)
      },
      onError: (_error, _input, context) =>
        cache.rollback(context?.transaction),
      onSettled: (_data, _error, _input, context) =>
        cache.settle(context?.transaction, [cache.listInvalidation]),
    }),
  )
}

export function useImportGuestCanvas() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const cache = useFilesCache()
  return useMutation(
    trpc.files.importGuest.mutationOptions({
      onMutate: async (input) => {
        const now = new Date()
        const file: FileSummary = {
          id: input.id,
          name: 'Untitled',
          folderId: null,
          version: 1,
          lastEditedById: sessionUser(queryClient)?.id ?? null,
          hasThumbnail: false,
          createdAt: now,
          updatedAt: now,
          trashedAt: null,
          owner: sessionUser(queryClient) ?? { id: '', name: 'You', email: '' },
          role: 'owner',
        }
        const transaction = await cache.begin(
          ['files'],
          [cache.listUpdate((rows, key) => replaceFileInList(rows, file, key))],
        )
        return { transaction, file }
      },
      onSuccess: (saved, _input, context) => {
        Object.assign(context.file, saved)
        cache.refresh(context.transaction)
        queryClient.setQueryData(
          trpc.files.get.queryKey({ id: saved.id }),
          saved,
        )
      },
      onError: (_error, _input, context) =>
        cache.rollback(context?.transaction),
      onSettled: (_data, _error, input, context) =>
        cache.settle(context?.transaction, [
          cache.listInvalidation,
          cache.fileInvalidation(input.id),
          {
            scope: 'files',
            filter: trpc.files.document.queryFilter({ id: input.id }),
          },
          { scope: 'settings', filter: trpc.settings.get.queryFilter() },
        ]),
    }),
  )
}

function useFileChange(
  change: (
    file: FileSummary,
    input: { id: string; name?: string; folderId?: string | null },
    now: Date,
  ) => FileSummary | null,
  affectsChats = false,
  affectsAnalytics = false,
) {
  const trpc = useTRPC()
  const cache = useFilesCache()
  const queryClient = useQueryClient()
  return {
    onMutate: async (input: {
      id: string
      name?: string
      folderId?: string | null
    }) => {
      await queryClient.cancelQueries(
        trpc.files.get.queryFilter({ id: input.id }),
      )
      const now = new Date()
      const source = cache.find(input.id)
      if (
        source &&
        !queryClient.getQueryData(trpc.files.get.queryKey({ id: input.id }))
      ) {
        queryClient.setQueryData(
          trpc.files.get.queryKey({ id: input.id }),
          source,
        )
      }
      const changed = source && change(source, input, now)
      const updates: CacheUpdate[] = [
        cache.detailUpdate(
          input.id,
          (file) => change(file, input, now) ?? file,
        ),
        cache.listUpdate((rows, key) => {
          const current = cache.find(input.id)
          return changed && current
            ? replaceFileInList(rows, current, key)
            : rows.filter((file) => file.id !== input.id)
        }),
      ]
      if (affectsChats) {
        updates.push({
          filter: trpc.chats.list.queryFilter(),
          update: (data) =>
            data &&
            (data as ChatSummary[]).flatMap((chat) => {
              if (chat.fileId !== input.id) return [chat]
              const current = cache.find(input.id)
              return changed && current && !current.trashedAt
                ? [{ ...chat, fileName: current.name }]
                : []
            }),
        })
        if (changed && !changed.trashedAt)
          updates.push({
            filter: trpc.chats.get.queryFilter(),
            update: (data) => {
              const detail = data as ChatDetail | undefined
              return detail?.chat.fileId === input.id
                ? {
                    ...detail,
                    chat: {
                      ...detail.chat,
                      fileName: cache.find(input.id)?.name ?? changed.name,
                    },
                  }
                : data
            },
          })
      }
      return cache.begin(affectsChats ? ['files', 'chats'] : ['files'], updates)
    },
    onError: (
      _error: unknown,
      _input: unknown,
      transaction?: Awaited<ReturnType<typeof cache.begin>>,
    ) => cache.rollback(transaction),
    onSettled: (
      _data: unknown,
      _error: unknown,
      { id }: { id: string },
      transaction?: Awaited<ReturnType<typeof cache.begin>>,
    ) =>
      cache.settle(transaction, [
        cache.listInvalidation,
        cache.fileInvalidation(id),
        ...(affectsChats
          ? [
              { scope: 'chats', filter: trpc.chats.list.queryFilter() },
              { scope: 'chats', filter: trpc.chats.activity.queryFilter() },
            ]
          : []),
        ...(affectsAnalytics
          ? [{ scope: 'chats', filter: trpc.chats.analytics.queryFilter() }]
          : []),
      ]),
  }
}

export function useRenameFile() {
  const trpc = useTRPC()
  return useMutation(
    trpc.files.rename.mutationOptions(
      useFileChange(
        (file, input, now) => ({
          ...file,
          name: input.name!.trim(),
          updatedAt: now,
        }),
        true,
      ),
    ),
  )
}

export function useMoveFile() {
  const trpc = useTRPC()
  return useMutation(
    trpc.files.move.mutationOptions(
      useFileChange((file, input, now) => ({
        ...file,
        folderId: input.folderId!,
        updatedAt: now,
      })),
    ),
  )
}

export function useTrashFile() {
  const trpc = useTRPC()
  return useMutation(
    trpc.files.trash.mutationOptions(
      useFileChange(
        (file, _input, now) => ({ ...file, trashedAt: now, updatedAt: now }),
        true,
        true,
      ),
    ),
  )
}

export function useRestoreFile() {
  const trpc = useTRPC()
  return useMutation(
    trpc.files.restore.mutationOptions(
      useFileChange(
        (file, _input, now) => ({ ...file, trashedAt: null, updatedAt: now }),
        true,
        true,
      ),
    ),
  )
}

export function useDestroyFile() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const options = useFileChange(() => null, true, true)
  return useMutation(
    trpc.files.destroy.mutationOptions({
      ...options,
      onSuccess: (_data, { id }) => {
        patchCache(queryClient, {
          filter: trpc.settings.get.queryFilter(),
          update: (data) => {
            const settings = data as
              RouterOutputs['settings']['get'] | undefined
            return settings?.lastEditedCanvasId === id
              ? { ...settings, lastEditedCanvasId: null }
              : settings
          },
        })
        queryClient.removeQueries(trpc.files.get.queryFilter({ id }))
        queryClient.removeQueries(trpc.files.document.queryFilter({ id }))
        queryClient.removeQueries(trpc.collaborators.list.queryFilter({ id }))
        for (const [key, detail] of queryClient.getQueriesData<ChatDetail>(
          trpc.chats.get.queryFilter(),
        )) {
          if (detail?.chat.fileId === id)
            queryClient.removeQueries({ queryKey: key, exact: true })
        }
      },
      onSettled: (_data, error, input, transaction) =>
        options.onSettled(_data, error, input, transaction),
    }),
  )
}

export function useSaveFileDocument() {
  const trpc = useTRPC()
  const cache = useFilesCache()
  return useMutation(
    trpc.files.saveDocument.mutationOptions({
      onSuccess: (saved, { id }) => {
        cache.patch({
          filter: trpc.settings.get.queryFilter(),
          update: (data) =>
            data && {
              ...(data as RouterOutputs['settings']['get']),
              lastEditedCanvasId: id,
            },
        })
        const update = (file: FileSummary) =>
          file.version > saved.version ? file : { ...file, ...saved }
        cache.patch(cache.detailUpdate(id, update))
        cache.patch(
          cache.listUpdate((rows, key) => {
            const file = rows.find((row) => row.id === id)
            return file ? replaceFileInList(rows, update(file), key) : rows
          }),
        )
      },
      onError: (error, { id }) =>
        errorCode(error) === 'CONFLICT'
          ? cache.settle(undefined, [
              cache.fileInvalidation(id),
              cache.listInvalidation,
            ])
          : undefined,
    }),
  )
}

export function useThumbnailUploaded() {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  return useCallback(
    (id: string) => {
      patchCache(queryClient, {
        filter: trpc.files.get.queryFilter({ id }),
        update: (data) =>
          data && { ...(data as FileSummary), hasThumbnail: true },
      })
      patchCache(queryClient, {
        filter: trpc.files.list.queryFilter(),
        update: (data) =>
          data &&
          (data as FileSummary[]).map((file) =>
            file.id === id ? { ...file, hasThumbnail: true } : file,
          ),
      })
    },
    [queryClient, trpc],
  )
}
