import { collaboratorsRouter } from './routers/collaborators'
import { filesRouter } from './routers/files'
import { foldersRouter } from './routers/folders'
import { router } from './trpc/init'

export const appRouter = router({
  files: filesRouter,
  folders: foldersRouter,
  collaborators: collaboratorsRouter,
})

export type AppRouter = typeof appRouter
export type { DocumentSnapshot } from './routers/files'
