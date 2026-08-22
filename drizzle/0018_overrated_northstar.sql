ALTER TABLE `partner_offers` ADD COLUMN IF NOT EXISTS `featuredStatus` enum('none','pending','approved','rejected') NOT NULL DEFAULT 'none';--> statement-breakpoint
ALTER TABLE `partner_offers` ADD COLUMN IF NOT EXISTS `featuredRequestedAt` timestamp;--> statement-breakpoint
ALTER TABLE `partner_offers` ADD COLUMN IF NOT EXISTS `featuredReviewedAt` timestamp;--> statement-breakpoint
ALTER TABLE `partner_offers` ADD COLUMN IF NOT EXISTS `featuredReviewNote` varchar(300);
