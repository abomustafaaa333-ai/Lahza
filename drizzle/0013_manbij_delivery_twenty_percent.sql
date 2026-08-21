ALTER TABLE `system_settings` MODIFY COLUMN `manbijDeliveryPercent` int NOT NULL DEFAULT 20;--> statement-breakpoint
UPDATE `system_settings` SET `manbijDeliveryPercent` = 20 WHERE `manbijDeliveryPercent` = 15;
