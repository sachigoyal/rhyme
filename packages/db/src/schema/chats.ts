import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import { users } from './auth'
import { createdAt, id, timestamps } from './columns'
import { files } from './drawings'

export const chats = sqliteTable(
  'chats',
  {
    id: id(),
    fileId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text().notNull().default('New conversation'),
    titleSource: text({
      enum: ['pending', 'generating', 'generated', 'manual'],
    })
      .notNull()
      .default('pending'),
    status: text({ enum: ['ready', 'running', 'error'] })
      .notNull()
      .default('ready'),
    lastMessage: text().notNull().default(''),
    messageCount: integer().notNull().default(0),
    toolCallCount: integer().notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    index('chats_user_updated_idx').on(t.userId, t.updatedAt),
    index('chats_file_user_idx').on(t.fileId, t.userId),
  ],
)

export const agentRuns = sqliteTable(
  'agent_runs',
  {
    id: id(),
    chatId: text()
      .notNull()
      .references(() => chats.id, { onDelete: 'cascade' }),
    model: text().notNull(),
    status: text({
      enum: ['running', 'completed', 'cancelled', 'error'],
    }).notNull(),
    inputTokens: integer().notNull().default(0),
    outputTokens: integer().notNull().default(0),
    totalTokens: integer().notNull().default(0),
    durationMs: integer().notNull().default(0),
    toolCallCount: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('agent_runs_chat_created_idx').on(t.chatId, t.createdAt)],
)

export const chatChanges = sqliteTable(
  'chat_changes',
  {
    id: id(),
    chatId: text()
      .notNull()
      .references(() => chats.id, { onDelete: 'cascade' }),
    toolCallId: text().notNull(),
    toolName: text().notNull(),
    summary: text().notNull(),
    previewKey: text(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('chat_changes_tool_idx').on(t.chatId, t.toolCallId),
    index('chat_changes_chat_created_idx').on(t.chatId, t.createdAt),
  ],
)

export const legacyChatImports = sqliteTable(
  'legacy_chat_imports',
  {
    fileId: text()
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    chatId: text().references(() => chats.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.fileId, t.userId] })],
)
