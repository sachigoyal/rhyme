import { chatsRouter } from './routers/chats'
import { collaboratorsRouter } from './routers/collaborators'
import { filesRouter } from './routers/files'
import { foldersRouter } from './routers/folders'
import { profileRouter } from './routers/profile'
import { router } from './trpc/init'

export const appRouter = router({
  chats: chatsRouter,
  files: filesRouter,
  folders: foldersRouter,
  collaborators: collaboratorsRouter,
  profile: profileRouter,
})

export type AppRouter = typeof appRouter
export type { DocumentSnapshot } from './routers/files'
