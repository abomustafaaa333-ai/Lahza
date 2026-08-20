CREATE TABLE `intercity_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tripId` int NOT NULL,
	`partnerId` int,
	`catalogItemId` int,
	`customerName` varchar(80) NOT NULL,
	`customerPhone` varchar(24) NOT NULL,
	`locationUrl` varchar(500) NOT NULL,
	`itemName` varchar(180) NOT NULL,
	`quantity` varchar(32) NOT NULL DEFAULT '1',
	`deliveryChoice` enum('pickup_point','doorstep') NOT NULL DEFAULT 'pickup_point',
	`itemAmount` int NOT NULL DEFAULT 0,
	`tripFee` int NOT NULL DEFAULT 0,
	`status` enum('new','accepted','ready','collected','delivered','cancelled') NOT NULL DEFAULT 'new',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `intercity_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `intercity_trips` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(140) NOT NULL,
	`bookingCloseLabel` varchar(160) NOT NULL,
	`arrivalLabel` varchar(160) NOT NULL,
	`capacity` int NOT NULL DEFAULT 0,
	`pickupFee` int NOT NULL DEFAULT 0,
	`doorstepFee` int NOT NULL DEFAULT 0,
	`status` enum('open','closed','dispatching','arrived') NOT NULL DEFAULT 'open',
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `intercity_trips_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `partner_offers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partnerId` int NOT NULL,
	`text` varchar(220) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `partner_offers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `partners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`username` varchar(64) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`storeOpen` boolean NOT NULL DEFAULT true,
	`preparationMinutes` int NOT NULL DEFAULT 20,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `partners_id` PRIMARY KEY(`id`),
	CONSTRAINT `partners_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
ALTER TABLE `catalog_items` ADD `partnerId` int;--> statement-breakpoint
ALTER TABLE `catalog_items` ADD `imageUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `intercity_orders` ADD CONSTRAINT `intercity_orders_tripId_intercity_trips_id_fk` FOREIGN KEY (`tripId`) REFERENCES `intercity_trips`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `intercity_orders` ADD CONSTRAINT `intercity_orders_partnerId_partners_id_fk` FOREIGN KEY (`partnerId`) REFERENCES `partners`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `intercity_orders` ADD CONSTRAINT `intercity_orders_catalogItemId_catalog_items_id_fk` FOREIGN KEY (`catalogItemId`) REFERENCES `catalog_items`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `partner_offers` ADD CONSTRAINT `partner_offers_partnerId_partners_id_fk` FOREIGN KEY (`partnerId`) REFERENCES `partners`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `catalog_items` ADD CONSTRAINT `catalog_items_partnerId_partners_id_fk` FOREIGN KEY (`partnerId`) REFERENCES `partners`(`id`) ON DELETE set null ON UPDATE no action;