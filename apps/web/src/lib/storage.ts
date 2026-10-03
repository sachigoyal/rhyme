import { env } from './env'
import type { FileSummary } from '@rhyme/trpc-client'

export type Thumbnail = Pick<
  FileSummary,
  'version' | 'hasThumbnail' | 'thumbnailRevision'
>

async function send(path: string, init: RequestInit) {
  const response = await fetch(new URL(path, env.apiUrl), {
    ...init,
    credentials: 'include',
  })
  if (!response.ok) throw new Error(`Upload failed (${response.status})`)
  return response
}

export async function uploadAsset(fileId: string, file: File) {
  const response = await send(`/files/${fileId}/assets`, {
    method: 'POST',
    body: file,
    headers: {
      'content-type': file.type,
      'x-file-name': encodeURIComponent(file.name),
    },
  })
  return (await response.json()) as { id: string; url: string }
}

export async function publishThumbnail(
  fileId: string,
  version: number,
  image: Blob | null,
): Promise<Thumbnail | null> {
  const response = await fetch(
    new URL(`/files/${fileId}/thumbnail?v=${version}`, env.apiUrl),
    {
      method: image ? 'PUT' : 'DELETE',
      body: image,
      credentials: 'include',
      headers: image ? { 'content-type': image.type } : undefined,
    },
  )
  if (response.status === 409) return null
  if (!response.ok)
    throw new Error(`Thumbnail update failed (${response.status})`)
  return response.json()
}

export const thumbnailUrl = (
  fileId: string,
  version: number,
  revision: string | null,
) => {
  const url = new URL(`/files/${fileId}/thumbnail?v=${version}`, env.apiUrl)
  if (revision) url.searchParams.set('revision', revision)
  return url.href
}
