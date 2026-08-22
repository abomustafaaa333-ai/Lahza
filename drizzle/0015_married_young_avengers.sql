CREATE TABLE `missing_product_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerName` varchar(80) NOT NULL,
	`customerPhone` varchar(24) NOT NULL,
	`productName` varchar(180) NOT NULL,
	`notes` varchar(500),
	`status` enum('new','contacted','fulfilled','closed') NOT NULL DEFAULT 'new',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `missing_product_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `catalog_items` MODIFY COLUMN `category` enum('restaurants','groceries','produce','bakery','butcher','gas','pharmacy','sweets','clothing','mobile_accessories','beauty_personal_care','baby','school_stationery','chicken','breakfast','lamb','fuel','other','offers','beauty_boutique') NOT NULL;--> statement-breakpoint
ALTER TABLE `stores` MODIFY COLUMN `category` enum('restaurants','groceries','produce','bakery','butcher','gas','pharmacy','sweets','clothing','mobile_accessories','beauty_personal_care','baby','school_stationery','chicken','breakfast','lamb','fuel','other','offers','beauty_boutique') NOT NULL;--> statement-breakpoint
UPDATE `stores` SET `category` = 'restaurants' WHERE `category` IN ('chicken', 'breakfast', 'lamb');--> statement-breakpoint
UPDATE `catalog_items` SET `category` = 'restaurants' WHERE `category` IN ('chicken', 'breakfast', 'lamb');--> statement-breakpoint
UPDATE `stores` SET `category` = 'beauty_personal_care' WHERE `category` = 'beauty_boutique';--> statement-breakpoint
UPDATE `catalog_items` SET `category` = 'beauty_personal_care' WHERE `category` = 'beauty_boutique';
