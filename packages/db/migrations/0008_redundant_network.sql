CREATE TABLE `ai_usage` (
	`user_id` text NOT NULL,
	`period` text NOT NULL,
	`tokens` integer DEFAULT 0 NOT NULL,
	`lease_id` text,
	`lease_expires_at` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `period`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
