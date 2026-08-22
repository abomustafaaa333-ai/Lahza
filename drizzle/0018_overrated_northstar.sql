ALTER TABLE `partner_offers` ADD `featuredStatus` enum('none','pending','approved','rejected') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `partner_offers` ADD `featuredStatus` enum('none','pending','approved','rejected') NOT NULL DEFAULT 'none';--> statement-breakpoint
ALTER TABLE `partner_offers` ADD `featuredRequestedAt` timestamp;--> statement-breakpoint
ALTER TABLE `partner_offers` ADD `featuredReviewedAt` timestamp;--> statement-breakpoint
ALTER TABLE `partner_offers` ADD `featuredReviewNote` varchar(300);
