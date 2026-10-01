import type { ExportedHandler } from '@cloudflare/workers-types'
import type { ProductionBindings } from './production-bindings'
import app from './index'

export { CanvasAgent } from './agents/canvas-agent'

const apiPath =
  /^(?:\/auth\/|\/trpc\/|\/profile\/|\/files\/[^/]+\/(?:assets|thumbnail|agent)(?:\/|$)|\/assets\/[0-9a-f-]{36}$)/i

export default {
  fetch(request, env, ctx) {
    if (apiPath.test(new URL(request.url).pathname))
      return app.fetch(request, env, ctx)
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<ProductionBindings>
