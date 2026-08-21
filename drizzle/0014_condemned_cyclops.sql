ALTER TABLE `orders` MODIFY COLUMN `status` enum('pending','confirmed','preparing','on_the_way','completed','cancelled','rejected') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `orders` ADD `locationMode` enum('gps','manual') DEFAULT 'gps' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `locationText` varchar(280);--> statement-breakpoint
ALTER TABLE `orders` ADD `locationUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `orders` ADD `locationLat` int;--> statement-breakpoint
ALTER TABLE `orders` ADD `locationLng` int;--> statement-breakpoint
ALTER TABLE `orders` ADD `statusReason` varchar(300);--> statement-breakpoint
ALTER TABLE `orders` ADD `statusChangedAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` MODIFY COLUMN `status` enum('pending','confirmed','preparing','on_the_way','completed','cancelled','rejected') NOT NULL DEFAULT 'pending';
