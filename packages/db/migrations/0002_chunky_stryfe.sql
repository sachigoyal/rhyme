CREATE TABLE `legacy_chat_imports` (
	`file_id` text NOT NULL,
	`user_id` text NOT NULL,
	`chat_id` text,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`file_id`, `user_id`),
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chat_id`) REFERENCES `chats`(`id`) ON UPDATE no action ON DELETE set null
);
