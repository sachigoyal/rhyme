import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { eq, sql } from 'drizzle-orm'
import { schema } from '@rhyme/db'
import type { AppEnv } from '../env'
import { objectKeys } from '../lib/storage'
import { fileAccess, session } from '../middleware'

const { assets, files } = schema

const MAX_ASSET_BYTES = 25 * 1024 * 1024
const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024
const ASSET_TYPES = /^(image|video)\//

async function readBody(request: Request, maxBytes: number) {
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > maxBytes) throw new HTTPException(413)
  const body = await request.arrayBuffer()
  if (body.byteLength > maxBytes) throw new HTTPException(413)
  return body
}

export const storageRoutes = new Hono<AppEnv>()
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
    const key = objectKeys.thumbnail(file.id)
    const body = await readBody(c.req.raw, MAX_THUMBNAIL_BYTES)

    await c.env.STORAGE.put(key, body, {
      httpMetadata: {
        contentType: c.req.header('content-type') ?? 'image/png',
      },
    })
    await c.var.db
      .update(files)
      .set({ thumbnailKey: key, updatedAt: sql`${files.updatedAt}` })
      .where(eq(files.id, file.id))

    return c.body(null, 204)
  })

  .get('/files/:fileId/thumbnail', session, fileAccess('viewer'), async (c) => {
    const { thumbnailKey } = c.var.access.file
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
