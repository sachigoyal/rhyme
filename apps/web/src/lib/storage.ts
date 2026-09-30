import { env } from './env'

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

export async function uploadThumbnail(fileId: string, image: Blob) {
  await send(`/files/${fileId}/thumbnail`, {
    method: 'PUT',
    body: image,
    headers: { 'content-type': image.type },
  })
}

export const thumbnailUrl = (fileId: string, version: number) =>
  new URL(`/files/${fileId}/thumbnail?v=${version}`, env.apiUrl).href
