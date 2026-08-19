CREATE TABLE `lahza_employees` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(80) NOT NULL,
	`phone` varchar(24) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lahza_employees_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `deliveryDistanceMeters` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `deliveryFee` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `system_settings` ADD `deliveryPricePerKm` int DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE `system_settings` ADD `originLatE6` int DEFAULT 36528100 NOT NULL;--> statement-breakpoint
ALTER TABLE `system_settings` ADD `originLngE6` int DEFAULT 37954900 NOT NULL;