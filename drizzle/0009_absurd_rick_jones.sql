ALTER TABLE `partner_offers` ADD `storeId` int;--> statement-breakpoint
ALTER TABLE `partner_offers` ADD `imageUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `partner_offers` ADD CONSTRAINT `partner_offers_storeId_stores_id_fk` FOREIGN KEY (`storeId`) REFERENCES `stores`(`id`) ON DELETE cascade ON UPDATE no action;