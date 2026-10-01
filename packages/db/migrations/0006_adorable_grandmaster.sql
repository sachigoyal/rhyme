CREATE TABLE `ai_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`provider` text NOT NULL,
	`base_url` text DEFAULT '' NOT NULL,
	`models` text NOT NULL,
	`vision` integer DEFAULT false NOT NULL,
	`encrypted_api_key` text NOT NULL,
	`key_hint` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
