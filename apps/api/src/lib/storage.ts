import type { R2Bucket } from '@cloudflare/workers-types'

export const objectKeys = {
  file: (fileId: string) => `files/${fileId}/`,
  document: (fileId: string) =>
    `files/${fileId}/documents/${crypto.randomUUID()}.json`,
  asset: (fileId: string, assetId: string) =>
    `files/${fileId}/assets/${assetId}`,
  thumbnail: (fileId: string, version: number) =>
    `files/${fileId}/thumbnails/${version}/${crypto.randomUUID()}`,
}

export const thumbnailRevision = (key: string | null) =>
  key?.split('/').pop() ?? null

export async function readJson<T>(bucket: R2Bucket, key: string) {
  const object = await bucket.get(key)
  return object ? await object.json<T>() : null
}

export async function writeJson(bucket: R2Bucket, key: string, value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  await bucket.put(key, bytes, {
    httpMetadata: { contentType: 'application/json' },
  })
  return bytes.byteLength
}

export async function deletePrefix(bucket: R2Bucket, prefix: string) {
  let cursor: string | undefined
  do {
    const page = await bucket.list({ prefix, cursor })
    if (page.objects.length) {
      await bucket.delete(page.objects.map((object) => object.key))
    }
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)
}
