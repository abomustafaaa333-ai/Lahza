CREATE TABLE `stores` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(140) NOT NULL,
	`category` enum('groceries','chicken','breakfast','lamb','butcher','fuel','pharmacy','other','offers','sweets','clothing','mobile_accessories','beauty_boutique') NOT NULL,
	`partnerId` int,
	`active` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `catalog_items` MODIFY COLUMN `category` enum('groceries','chicken','breakfast','lamb','butcher','fuel','pharmacy','other','offers','sweets','clothing','mobile_accessories','beauty_boutique') NOT NULL;--> statement-breakpoint
ALTER TABLE `catalog_items` ADD `storeId` int;--> statement-breakpoint
ALTER TABLE `stores` ADD CONSTRAINT `stores_partnerId_partners_id_fk` FOREIGN KEY (`partnerId`) REFERENCES `partners`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `catalog_items` ADD CONSTRAINT `catalog_items_storeId_stores_id_fk` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE set null ON UPDATE no action;