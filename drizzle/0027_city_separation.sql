ALTER TABLE `partners` ADD `city` enum('manbij','jarabulus') NOT NULL DEFAULT 'manbij';
--> statement-breakpoint
ALTER TABLE `stores` ADD `city` enum('manbij','jarabulus') NOT NULL DEFAULT 'manbij';
--> statement-breakpoint
ALTER TABLE `supervisors` ADD `city` enum('manbij','jarabulus') NOT NULL DEFAULT 'manbij';
