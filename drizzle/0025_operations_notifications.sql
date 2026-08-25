CREATE TABLE `drivers` (
  `id` int AUTO_INCREMENT NOT NULL,
  `name` varchar(80) NOT NULL,
  `phone` varchar(24) NOT NULL,
  `vehicleType` enum('motorcycle','car','van') NOT NULL DEFAULT 'motorcycle',
  `region` varchar(120) NOT NULL DEFAULT 'منبج',
  `active` boolean NOT NULL DEFAULT true,
  `available` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `drivers_id` PRIMARY KEY(`id`),
  CONSTRAINT `drivers_phone_unique` UNIQUE(`phone`)
);
--> statement-breakpoint

CREATE TABLE `order_assignments` (
  `id` int AUTO_INCREMENT NOT NULL,
  `orderId` int NOT NULL,
  `driverId` int NOT NULL,
  `status` enum('assigned','accepted','picked_up','delivered','cancelled') NOT NULL DEFAULT 'assigned',
  `note` varchar(300),
  `assignedAt` timestamp NOT NULL DEFAULT (now()),
  `acceptedAt` timestamp,
  `deliveredAt` timestamp,
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `order_assignments_id` PRIMARY KEY(`id`),
  CONSTRAINT `order_assignments_order_unique` UNIQUE(`orderId`),
  CONSTRAINT `order_assignments_order_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
  CONSTRAINT `order_assignments_driver_fk` FOREIGN KEY (`driverId`) REFERENCES `drivers`(`id`) ON DELETE RESTRICT
);
--> statement-breakpoint

CREATE TABLE `inventory_movements` (
  `id` int AUTO_INCREMENT NOT NULL,
  `catalogItemId` int NOT NULL,
  `quantityDelta` int NOT NULL,
  `reason` enum('purchase','adjustment','order_reserved','order_released') NOT NULL,
  `orderId` int,
  `note` varchar(300),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `inventory_movements_id` PRIMARY KEY(`id`),
  CONSTRAINT `inventory_movements_catalog_fk` FOREIGN KEY (`catalogItemId`) REFERENCES `catalog_items`(`id`) ON DELETE CASCADE,
  CONSTRAINT `inventory_movements_order_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint

CREATE TABLE `finance_entries` (
  `id` int AUTO_INCREMENT NOT NULL,
  `orderId` int,
  `kind` enum('order_income','delivery_fee','partner_payable','driver_payable','adjustment') NOT NULL,
  `direction` enum('credit','debit') NOT NULL,
  `amount` int NOT NULL DEFAULT 0,
  `status` enum('open','settled','void') NOT NULL DEFAULT 'open',
  `note` varchar(300),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `settledAt` timestamp,
  CONSTRAINT `finance_entries_id` PRIMARY KEY(`id`),
  CONSTRAINT `finance_entries_order_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint

CREATE TABLE `notification_campaigns` (
  `id` int AUTO_INCREMENT NOT NULL,
  `kind` enum('offer','event','reminder') NOT NULL,
  `title` varchar(120) NOT NULL,
  `body` varchar(300) NOT NULL,
  `targetPath` varchar(180) NOT NULL DEFAULT '/',
  `scheduledAt` timestamp,
  `expiresAt` timestamp,
  `active` boolean NOT NULL DEFAULT true,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  `updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `notification_campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint

CREATE TABLE `customer_notifications` (
  `id` int AUTO_INCREMENT NOT NULL,
  `campaignId` int NOT NULL,
  `deviceId` varchar(80) NOT NULL,
  `readAt` timestamp,
  `deliveredAt` timestamp NOT NULL DEFAULT (now()),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `customer_notifications_id` PRIMARY KEY(`id`),
  CONSTRAINT `customer_notifications_campaign_device_unique` UNIQUE(`campaignId`,`deviceId`),
  CONSTRAINT `customer_notifications_campaign_fk` FOREIGN KEY (`campaignId`) REFERENCES `notification_campaigns`(`id`) ON DELETE CASCADE,
  CONSTRAINT `customer_notifications_device_fk` FOREIGN KEY (`deviceId`) REFERENCES `customer_presence`(`deviceId`) ON DELETE CASCADE
);
