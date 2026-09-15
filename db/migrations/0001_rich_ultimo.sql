DROP INDEX `idx_bookings_active_slot`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bookings_active_slot` ON `bookings` (`slot_id`) WHERE "status" NOT IN ('cancelled', 'no_show');