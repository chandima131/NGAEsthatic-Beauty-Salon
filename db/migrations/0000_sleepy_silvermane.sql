CREATE TABLE `availability_slots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slot_date` text NOT NULL,
	`start_time` text NOT NULL,
	`duration_minutes` integer DEFAULT 60 NOT NULL,
	`status` text DEFAULT 'available' NOT NULL,
	`note` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_availability_slots_date_time` ON `availability_slots` (`slot_date`,`start_time`);--> statement-breakpoint
CREATE INDEX `idx_availability_slots_date_status` ON `availability_slots` (`slot_date`,`status`);--> statement-breakpoint
CREATE TABLE `blackouts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`start_time` text,
	`end_time` text,
	`type` text NOT NULL,
	`label` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_blackouts_dates` ON `blackouts` (`start_date`,`end_date`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`slot_id` integer NOT NULL,
	`customer_name` text NOT NULL,
	`phone` text NOT NULL,
	`email` text,
	`treatment` text NOT NULL,
	`customer_notes` text,
	`admin_notes` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`slot_id`) REFERENCES `availability_slots`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bookings_active_slot` ON `bookings` (`slot_id`) WHERE "status" IN ('pending', 'confirmed');--> statement-breakpoint
CREATE INDEX `idx_bookings_status_created` ON `bookings` (`status`,`created_at`);