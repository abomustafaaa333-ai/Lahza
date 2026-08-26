CREATE TABLE `customer_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phone` varchar(24) NOT NULL,
	`name` varchar(80) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`verifiedAt` timestamp NULL,
	`verifiedBy` varchar(80),
	`rejectionReason` varchar(300),
	`lastOrderId` int,
	`createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updatedAt` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `customer_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_accounts_phone_unique` UNIQUE(`phone`)
);
