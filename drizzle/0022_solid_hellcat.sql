ALTER TABLE `point_transactions` MODIFY COLUMN `reason` enum('order_completed','referral_completed','reward_redeemed') NOT NULL;--> statement-breakpoint
ALTER TABLE `point_transactions` ADD `rewardPercent` int;--> statement-breakpoint
ALTER TABLE `system_settings` ADD `pointsRewardPercent` int DEFAULT 0 NOT NULL;