CREATE TABLE `login_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ip` text NOT NULL,
	`email` text NOT NULL,
	`success` integer NOT NULL,
	`timestamp` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `login_attempts_ip_timestamp_idx` ON `login_attempts` (`ip`,`timestamp`);--> statement-breakpoint
DROP INDEX `tags_name_unique`;--> statement-breakpoint
ALTER TABLE `tags` ADD `user_id` integer NOT NULL REFERENCES users(id);--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_user_unique` ON `tags` (`name`,`user_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`password_hash` text,
	`auth_provider` text DEFAULT 'password' NOT NULL,
	`provider_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "email", "display_name", "role", "password_hash", "auth_provider", "provider_id", "created_at") SELECT "id", "email", "display_name", "role", "password_hash", "auth_provider", "provider_id", "created_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `attachments` ADD `user_id` integer NOT NULL REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `attachments` ADD `featured` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `notes` ADD `user_id` integer NOT NULL REFERENCES users(id);--> statement-breakpoint
CREATE INDEX `notes_user_id_idx` ON `notes` (`user_id`);--> statement-breakpoint
ALTER TABLE `sessions` ADD `created_at` integer;--> statement-breakpoint
ALTER TABLE `sessions` ADD `user_agent` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `ip` text;--> statement-breakpoint
ALTER TABLE `sessions` ADD `last_used_at` integer;--> statement-breakpoint
ALTER TABLE `sync_log` ADD `user_id` integer NOT NULL REFERENCES users(id);