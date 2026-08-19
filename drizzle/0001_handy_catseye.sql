CREATE TABLE `catalog_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(80) NOT NULL,
	`name` varchar(160) NOT NULL,
	`category` enum('groceries','chicken','breakfast','lamb','butcher','fuel','pharmacy') NOT NULL,
	`unit` varchar(16) NOT NULL,
	`unitPrice` int NOT NULL DEFAULT 0,
	`available` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `catalog_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `catalog_items_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `order_lines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`catalogItemId` int,
	`category` varchar(32) NOT NULL,
	`itemName` varchar(160) NOT NULL,
	`quantity` varchar(32) NOT NULL,
	`unit` varchar(16) NOT NULL,
	`unitPrice` int NOT NULL DEFAULT 0,
	`lineTotal` int NOT NULL DEFAULT 0,
	`priceKnown` boolean NOT NULL DEFAULT false,
	`notes` text,
	CONSTRAINT `order_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderType` enum('delivery','taxi') NOT NULL,
	`customerName` varchar(80) NOT NULL,
	`customerPhone` varchar(24) NOT NULL,
	`paymentMethod` enum('sham_cash','cash') NOT NULL,
	`totalAmount` int NOT NULL DEFAULT 0,
	`status` enum('pending','confirmed','preparing','on_the_way','completed','cancelled') NOT NULL DEFAULT 'pending',
	`taxiType` enum('standard','van'),
	`pickupLocation` varchar(220),
	`destination` varchar(220),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `supervisors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(64) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `supervisors_id` PRIMARY KEY(`id`),
	CONSTRAINT `supervisors_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`id` int NOT NULL,
	`masterPinHash` varchar(255) NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `system_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `order_lines` ADD CONSTRAINT `order_lines_orderId_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `order_lines` ADD CONSTRAINT `order_lines_catalogItemId_catalog_items_id_fk` FOREIGN KEY (`catalogItemId`) REFERENCES `catalog_items`(`id`) ON DELETE set null ON UPDATE no action;