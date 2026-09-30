CREATE TABLE `user_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`role` text,
	`use_cases` text DEFAULT '[]' NOT NULL,
	`team_size` text,
	`referral` text,
	`analytics_consent` integer DEFAULT false NOT NULL,
	`completed_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `agent_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`chat_id` text NOT NULL,
	`model` text NOT NULL,
	`status` text NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`total_tokens` integer DEFAULT 0 NOT NULL,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`tool_call_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`chat_id`) REFERENCES `chats`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agent_runs_chat_created_idx` ON `agent_runs` (`chat_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `chat_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`chat_id` text NOT NULL,
	`tool_call_id` text NOT NULL,
	`tool_name` text NOT NULL,
	`summary` text NOT NULL,
	`preview_key` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`chat_id`) REFERENCES `chats`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chat_changes_tool_idx` ON `chat_changes` (`chat_id`,`tool_call_id`);--> statement-breakpoint
CREATE INDEX `chat_changes_chat_created_idx` ON `chat_changes` (`chat_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `chats` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`user_id` text NOT NULL,
	`title` text DEFAULT 'New conversation' NOT NULL,
	`status` text DEFAULT 'ready' NOT NULL,
	`last_message` text DEFAULT '' NOT NULL,
	`message_count` integer DEFAULT 0 NOT NULL,
	`tool_call_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chats_user_updated_idx` ON `chats` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `chats_file_user_idx` ON `chats` (`file_id`,`user_id`);