CREATE TABLE `customer_referrals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(40) NOT NULL,
	`ownerPhone` varchar(24) NOT NULL,
	`referredPhone` varchar(24),
	`referredOrderId` int,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customer_referrals_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_referrals_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `discount_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(40) NOT NULL,
	`discountPercent` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	`maxUses` int,
	`usedCount` int NOT NULL DEFAULT 0,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `discount_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `discount_codes_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `discountCode` varchar(40);--> statement-breakpoint
ALTER TABLE `orders` ADD `referralCode` varchar(40);--> statement-breakpoint
ALTER TABLE `orders` ADD `discountAmount` int DEFAULT 0 NOT NULL;