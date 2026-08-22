CREATE TABLE `customer_points` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerPhone` varchar(24) NOT NULL,
	`balance` int NOT NULL DEFAULT 0,
	`lifetimeEarned` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_points_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_points_customerPhone_unique` UNIQUE(`customerPhone`)
);
--> statement-breakpoint
CREATE TABLE `point_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerPhone` varchar(24) NOT NULL,
	`points` int NOT NULL DEFAULT 1,
	`reason` enum('order_completed','referral_completed') NOT NULL,
	`orderId` int,
	`referralId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `point_transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `point_transactions_order_unique` UNIQUE(`orderId`),
	CONSTRAINT `point_transactions_referral_unique` UNIQUE(`referralId`)
);
