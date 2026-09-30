import { chatsRouter } from './routers/chats'
import { collaboratorsRouter } from './routers/collaborators'
import { filesRouter } from './routers/files'
import { foldersRouter } from './routers/folders'
import { profileRouter } from './routers/profile'
import { settingsRouter } from './routers/settings'
import { router } from './trpc/init'

export const appRouter = router({
  chats: chatsRouter,
  files: filesRouter,
  folders: foldersRouter,
  collaborators: collaboratorsRouter,
  profile: profileRouter,
  settings: settingsRouter,
})

export type AppRouter = typeof appRouter
export type { DocumentSnapshot } from './routers/files'
