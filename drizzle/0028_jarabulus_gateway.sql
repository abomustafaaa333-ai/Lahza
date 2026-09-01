ALTER TABLE `stores` ADD `jarabulusGatewayEnabled` boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE `orders` ADD `orderCity` enum('manbij','jarabulus') NOT NULL DEFAULT 'manbij';
--> statement-breakpoint
ALTER TABLE `orders` ADD `fulfillmentScope` enum('local','manbij_to_jarabulus') NOT NULL DEFAULT 'local';
--> statement-breakpoint
ALTER TABLE `orders` ADD `preparationMinutes` int NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `system_settings` ADD `jarabulusMinimumOrder` int NOT NULL DEFAULT 500;
--> statement-breakpoint
ALTER TABLE `system_settings` ADD `jarabulusPreparationMinutes` int NOT NULL DEFAULT 120;
--> statement-breakpoint
CREATE TABLE `order_notifications` (
  `id` int AUTO_INCREMENT NOT NULL,
  `orderId` int NOT NULL,
  `customerPhone` varchar(24) NOT NULL,
  `status` enum('pending','confirmed','preparing','on_the_way','completed','cancelled','rejected') NOT NULL,
  `title` varchar(120) NOT NULL,
  `body` varchar(300) NOT NULL,
  `readAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `order_notifications_id` PRIMARY KEY(`id`),
  CONSTRAINT `order_notifications_orderId_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE cascade
);
