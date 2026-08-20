ALTER TABLE `partner_offers` ADD `imageStorageKey` varchar(500);--> statement-breakpoint
ALTER TABLE `partner_offers` ADD `imageDeletePending` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `partner_offers` ADD `durationDays` int;--> statement-breakpoint
ALTER TABLE `partner_offers` ADD `expiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `partner_offers` ADD `deletedAt` timestamp;