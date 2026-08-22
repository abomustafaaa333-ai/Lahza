CREATE TABLE `store_traffic_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`storeId` int NOT NULL,
	`source` enum('direct','qr') NOT NULL DEFAULT 'direct',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `store_traffic_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `store_traffic_events` ADD CONSTRAINT `store_traffic_events_storeId_stores_id_fk` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE cascade ON UPDATE no action;