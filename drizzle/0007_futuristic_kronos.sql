CREATE TABLE `capture_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`note_id` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`note_id`) REFERENCES `notes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `capture_requests_user_key_unique` ON `capture_requests` (`user_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `capture_requests_note_id_idx` ON `capture_requests` (`note_id`);--> statement-breakpoint
CREATE INDEX `capture_requests_created_at_idx` ON `capture_requests` (`created_at`);