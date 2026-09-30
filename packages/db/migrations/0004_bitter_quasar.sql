CREATE TABLE `user_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`home_destination` text DEFAULT 'dashboard' NOT NULL,
	`theme` text DEFAULT 'system' NOT NULL,
	`show_grid` integer DEFAULT false NOT NULL,
	`snap_to_shapes` integer DEFAULT false NOT NULL,
	`open_assistant` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
