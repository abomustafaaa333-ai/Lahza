CREATE TABLE `custom_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(80) NOT NULL,
	`title` varchar(120) NOT NULL,
	`subtitle` varchar(180) NOT NULL DEFAULT 'متاجر ومنتجات القسم',
	`active` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `custom_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `custom_categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `catalog_items` MODIFY COLUMN `category` enum('restaurants','groceries','household','produce','bakery','butcher','gas','pharmacy','sweets','clothing','mobile_accessories','beauty_personal_care','baby','school_stationery','chicken','breakfast','lamb','fuel','other','offers','beauty_boutique') NOT NULL;--> statement-breakpoint
ALTER TABLE `stores` MODIFY COLUMN `category` enum('restaurants','groceries','household','produce','bakery','butcher','gas','pharmacy','sweets','clothing','mobile_accessories','beauty_personal_care','baby','school_stationery','chicken','breakfast','lamb','fuel','other','offers','beauty_boutique') NOT NULL;--> statement-breakpoint
ALTER TABLE `catalog_items` ADD `customCategoryId` int;--> statement-breakpoint
ALTER TABLE `stores` ADD `customCategoryId` int;--> statement-breakpoint
ALTER TABLE `catalog_items` ADD CONSTRAINT `catalog_items_customCategoryId_custom_categories_id_fk` FOREIGN KEY (`customCategoryId`) REFERENCES `custom_categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stores` ADD CONSTRAINT `stores_customCategoryId_custom_categories_id_fk` FOREIGN KEY (`customCategoryId`) REFERENCES `custom_categories`(`id`) ON DELETE set null ON UPDATE no action;