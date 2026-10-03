import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { schema } from '@rhyme/db'
import type { AppEnv } from '../env'
import { objectKeys, thumbnailRevision } from '../lib/storage'
import { fileAccess, session } from '../middleware'

const { assets, files, users } = schema

const MAX_ASSET_BYTES = 25 * 1024 * 1024
const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024
const ASSET_TYPES = /^(image|video)\//

async function readBody(request: Request, maxBytes: number) {
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > maxBytes) throw new HTTPException(413)
  const reader = request.body?.getReader()
  if (!reader) throw new HTTPException(400)
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel()
      throw new HTTPException(413)
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes.buffer
}

export const storageRoutes = new Hono<AppEnv>()
  .put('/profile/picture', session, async (c) => {
    const user = c.var.session?.user
    if (!user) throw new HTTPException(401)
    const mimeType = c.req.header('content-type') ?? ''
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType))
      throw new HTTPException(415)
    const body = await readBody(c.req.raw, 2 * 1024 * 1024)
    const bytes = new Uint8Array(body)
    const png = [137, 80, 78, 71, 13, 10, 26, 10].every(
      (n, i) => bytes[i] === n,
    )
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    const webp =
      new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
      new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
    if (
      !(mimeType === 'image/png'
        ? png
        : mimeType === 'image/jpeg'
          ? jpeg
          : webp)
    )
      throw new HTTPException(415)
    const id = crypto.randomUUID()
    const key = `profiles/${user.id}/${id}`
    const image = new URL(`/profile/pictures/${user.id}/${id}`, c.env.API_URL)
      .href
    await c.env.STORAGE.put(key, body, {
      httpMetadata: { contentType: mimeType },
    })
    try {
      await c.var.db.update(users).set({ image }).where(eq(users.id, user.id))
    } catch (error) {
      await c.env.STORAGE.delete(key)
      throw error
    }
    if (
      user.image?.startsWith(
        new URL(`/profile/pictures/${user.id}/`, c.env.API_URL).href,
      )
    ) {
      const oldId = new URL(user.image).pathname.split('/').pop()
      c.executionCtx.waitUntil(
        c.env.STORAGE.delete(`profiles/${user.id}/${oldId}`),
      )
    }
    return c.json({ image })
  })
  .delete('/profile/picture', session, async (c) => {
    const user = c.var.session?.user
    if (!user) throw new HTTPException(401)
    await c.var.db
      .update(users)
      .set({ image: null })
      .where(eq(users.id, user.id))
    if (
      user.image?.startsWith(
        new URL(`/profile/pictures/${user.id}/`, c.env.API_URL).href,
      )
    ) {
      const oldId = new URL(user.image).pathname.split('/').pop()
      c.executionCtx.waitUntil(
        c.env.STORAGE.delete(`profiles/${user.id}/${oldId}`),
      )
    }
    return c.json({ image: null })
  })
  .get('/profile/pictures/:userId/:id', async (c) => {
    const object = await c.env.STORAGE.get(
      `profiles/${c.req.param('userId')}/${c.req.param('id')}`,
    )
    if (!object) throw new HTTPException(404)
    return new Response(object.body as ReadableStream, {
      headers: {
        'content-type': object.httpMetadata?.contentType ?? 'image/png',
        'cache-control': 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
      },
    })
  })
  .post('/files/:fileId/assets', session, fileAccess('editor'), async (c) => {
    const mimeType = c.req.header('content-type') ?? ''
    if (!ASSET_TYPES.test(mimeType)) throw new HTTPException(415)

    const { file } = c.var.access
    const id = crypto.randomUUID()
    const key = objectKeys.asset(file.id, id)
    const body = await readBody(c.req.raw, MAX_ASSET_BYTES)

    await c.env.STORAGE.put(key, body, {
      httpMetadata: { contentType: mimeType },
    })
    await c.var.db.insert(assets).values({
      id,
      key,
      fileId: file.id,
      uploadedById: c.var.session?.user.id,
      name: decodeURIComponent(c.req.header('x-file-name') ?? id),
      mimeType,
      size: body.byteLength,
    })

    return c.json(
      { id, url: new URL(`/assets/${id}`, c.env.API_URL).href },
      201,
    )
  })

  // Asset ids are unguessable; the canvas loads them without credentials.
  .get('/assets/:assetId', async (c) => {
    const asset = await c.var.db
      .select({ key: assets.key, mimeType: assets.mimeType })
      .from(assets)
      .where(eq(assets.id, c.req.param('assetId')))
      .get()
    const object = asset && (await c.env.STORAGE.get(asset.key))
    if (!asset || !object) throw new HTTPException(404)

    return new Response(object.body as ReadableStream, {
      headers: {
        'content-type': asset.mimeType,
        'cache-control': 'public, max-age=31536000, immutable',
        etag: object.httpEtag,
      },
    })
  })

  .put('/files/:fileId/thumbnail', session, fileAccess('editor'), async (c) => {
    const { file } = c.var.access
    const version = Number(c.req.query('v'))
    if (!c.req.query('v') || !Number.isSafeInteger(version) || version < 0)
      throw new HTTPException(400)
    if (version !== file.version) throw new HTTPException(409)
    const key = objectKeys.thumbnail(file.id, version)
    const body = await readBody(c.req.raw, MAX_THUMBNAIL_BYTES)

    await c.env.STORAGE.put(key, body, {
      httpMetadata: {
        contentType: c.req.header('content-type') ?? 'image/png',
      },
    })
    try {
      const saved = await c.var.db
        .update(files)
        .set({ thumbnailKey: key, updatedAt: sql`${files.updatedAt}` })
        .where(
          and(
            eq(files.id, file.id),
            eq(files.version, version),
            file.thumbnailKey
              ? eq(files.thumbnailKey, file.thumbnailKey)
              : isNull(files.thumbnailKey),
          ),
        )
        .returning({ id: files.id })
        .get()
      if (!saved) throw new HTTPException(409)
    } catch (error) {
      await c.env.STORAGE.delete(key)
      throw error
    }
    if (file.thumbnailKey)
      c.executionCtx.waitUntil(c.env.STORAGE.delete(file.thumbnailKey))
    return c.json({
      version,
      hasThumbnail: true,
      thumbnailRevision: thumbnailRevision(key),
    })
  })

  .delete(
    '/files/:fileId/thumbnail',
    session,
    fileAccess('editor'),
    async (c) => {
      const { file } = c.var.access
      const version = Number(c.req.query('v'))
      if (!c.req.query('v') || !Number.isSafeInteger(version) || version < 0)
        throw new HTTPException(400)
      const saved = await c.var.db
        .update(files)
        .set({ thumbnailKey: null, updatedAt: sql`${files.updatedAt}` })
        .where(
          and(
            eq(files.id, file.id),
            eq(files.version, version),
            file.thumbnailKey
              ? eq(files.thumbnailKey, file.thumbnailKey)
              : isNull(files.thumbnailKey),
          ),
        )
        .returning({ id: files.id })
        .get()
      if (!saved) throw new HTTPException(409)
      if (file.thumbnailKey)
        c.executionCtx.waitUntil(c.env.STORAGE.delete(file.thumbnailKey))
      return c.json({ version, hasThumbnail: false, thumbnailRevision: null })
    },
  )

  .get('/files/:fileId/thumbnail', session, fileAccess('viewer'), async (c) => {
    const { thumbnailKey, version } = c.var.access.file
    const requestedVersion = c.req.query('v')
    const requestedRevision = c.req.query('revision')
    if (
      (requestedVersion !== undefined &&
        Number(requestedVersion) !== version) ||
      (requestedRevision !== undefined &&
        requestedRevision !== thumbnailRevision(thumbnailKey))
    )
      throw new HTTPException(404)
    const object = thumbnailKey && (await c.env.STORAGE.get(thumbnailKey))
    if (!object) throw new HTTPException(404)

    return new Response(object.body as ReadableStream, {
      headers: {
        'content-type': object.httpMetadata?.contentType ?? 'image/png',
        'cache-control': 'private, max-age=60',
        etag: object.httpEtag,
      },
    })
  })
