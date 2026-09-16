CREATE TABLE `booking_segments` (
	`booking_id` text NOT NULL,
	`slot_date` text NOT NULL,
	`segment_time` text NOT NULL,
	PRIMARY KEY(`slot_date`, `segment_time`),
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_booking_segments_booking` ON `booking_segments` (`booking_id`);--> statement-breakpoint
DROP INDEX `idx_bookings_active_slot`;--> statement-breakpoint
ALTER TABLE `bookings` ADD `duration_minutes` integer DEFAULT 60 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bookings_active_slot` ON `bookings` (`slot_id`) WHERE "status" IN ('pending', 'confirmed');
--> statement-breakpoint
INSERT OR IGNORE INTO `booking_segments` (`booking_id`, `slot_date`, `segment_time`)
SELECT b.`id`, s.`slot_date`, substr(time(s.`start_time`, '+0 minutes'), 1, 5)
FROM `bookings` b
JOIN `availability_slots` s ON s.`id` = b.`slot_id`
WHERE b.`status` IN ('pending', 'confirmed') AND b.`duration_minutes` > 0;
--> statement-breakpoint
INSERT OR IGNORE INTO `booking_segments` (`booking_id`, `slot_date`, `segment_time`)
SELECT b.`id`, s.`slot_date`, substr(time(s.`start_time`, '+30 minutes'), 1, 5)
FROM `bookings` b
JOIN `availability_slots` s ON s.`id` = b.`slot_id`
WHERE b.`status` IN ('pending', 'confirmed') AND b.`duration_minutes` > 30;
--> statement-breakpoint
INSERT OR IGNORE INTO `booking_segments` (`booking_id`, `slot_date`, `segment_time`)
SELECT b.`id`, s.`slot_date`, substr(time(s.`start_time`, '+60 minutes'), 1, 5)
FROM `bookings` b
JOIN `availability_slots` s ON s.`id` = b.`slot_id`
WHERE b.`status` IN ('pending', 'confirmed') AND b.`duration_minutes` > 60;
--> statement-breakpoint
INSERT OR IGNORE INTO `booking_segments` (`booking_id`, `slot_date`, `segment_time`)
SELECT b.`id`, s.`slot_date`, substr(time(s.`start_time`, '+90 minutes'), 1, 5)
FROM `bookings` b
JOIN `availability_slots` s ON s.`id` = b.`slot_id`
WHERE b.`status` IN ('pending', 'confirmed') AND b.`duration_minutes` > 90;
--> statement-breakpoint
INSERT OR IGNORE INTO `booking_segments` (`booking_id`, `slot_date`, `segment_time`)
SELECT b.`id`, s.`slot_date`, substr(time(s.`start_time`, '+120 minutes'), 1, 5)
FROM `bookings` b
JOIN `availability_slots` s ON s.`id` = b.`slot_id`
WHERE b.`status` IN ('pending', 'confirmed') AND b.`duration_minutes` > 120;
--> statement-breakpoint
INSERT OR IGNORE INTO `booking_segments` (`booking_id`, `slot_date`, `segment_time`)
SELECT b.`id`, s.`slot_date`, substr(time(s.`start_time`, '+150 minutes'), 1, 5)
FROM `bookings` b
JOIN `availability_slots` s ON s.`id` = b.`slot_id`
WHERE b.`status` IN ('pending', 'confirmed') AND b.`duration_minutes` > 150;
