PRAGMA defer_foreign_keys=ON;
CREATE TABLE __saved_agent_runs AS SELECT * FROM agent_runs;
CREATE TABLE __saved_chat_changes AS SELECT * FROM chat_changes;
CREATE TABLE __saved_legacy_chat_imports AS SELECT * FROM legacy_chat_imports;--> statement-breakpoint
CREATE TABLE `__new_chats` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`user_id` text NOT NULL,
	`title` text DEFAULT 'New conversation' NOT NULL,
	`title_source` text DEFAULT 'pending' NOT NULL,
	`status` text DEFAULT 'ready' NOT NULL,
	`last_message` text DEFAULT '' NOT NULL,
	`message_count` integer DEFAULT 0 NOT NULL,
	`tool_call_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_chats`("id", "file_id", "user_id", "title", "title_source", "status", "last_message", "message_count", "tool_call_count", "created_at", "updated_at") SELECT "id", "file_id", "user_id", "title", "title_source", "status", "last_message", "message_count", "tool_call_count", "created_at", "updated_at" FROM `chats`;--> statement-breakpoint
DROP TABLE `chats`;--> statement-breakpoint
ALTER TABLE `__new_chats` RENAME TO `chats`;--> statement-breakpoint
INSERT OR REPLACE INTO agent_runs SELECT * FROM __saved_agent_runs;
INSERT OR REPLACE INTO chat_changes SELECT * FROM __saved_chat_changes;
INSERT OR REPLACE INTO legacy_chat_imports SELECT * FROM __saved_legacy_chat_imports;
DROP TABLE __saved_agent_runs;
DROP TABLE __saved_chat_changes;
DROP TABLE __saved_legacy_chat_imports;
PRAGMA defer_foreign_keys=OFF;--> statement-breakpoint
CREATE INDEX `chats_user_updated_idx` ON `chats` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `chats_file_user_idx` ON `chats` (`file_id`,`user_id`);