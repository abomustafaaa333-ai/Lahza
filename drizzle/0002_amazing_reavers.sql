CREATE TABLE `customer_presence` (
	`deviceId` varchar(80) NOT NULL,
	`lastSeen` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_presence_deviceId` PRIMARY KEY(`deviceId`)
);
--> statement-breakpoint
CREATE TABLE `customer_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deviceId` varchar(80) NOT NULL,
	`name` varchar(80) NOT NULL,
	`phone` varchar(24) NOT NULL DEFAULT '',
	`location` varchar(280) NOT NULL,
	`locationUrl` varchar(500) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_profiles_deviceId_unique` UNIQUE(`deviceId`)
);
