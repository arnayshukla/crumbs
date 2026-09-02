CREATE TABLE `quick_capture_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quick_capture_tokens_key_hash_unique` ON `quick_capture_tokens` (`key_hash`);--> statement-breakpoint
CREATE INDEX `quick_capture_tokens_user_id_idx` ON `quick_capture_tokens` (`user_id`);