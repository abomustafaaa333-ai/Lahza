ALTER TABLE `system_settings` ADD COLUMN IF NOT EXISTS `manbijDeliveryPercent` int DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE `system_settings` ADD COLUMN IF NOT EXISTS `jarabulusDeliveryPercent` int DEFAULT 30 NOT NULL;
