ALTER TABLE `order_assignments` DROP FOREIGN KEY `order_assignments_driver_fk`;
--> statement-breakpoint
ALTER TABLE `order_assignments` ADD `driverName` varchar(80);
--> statement-breakpoint
ALTER TABLE `order_assignments` MODIFY COLUMN `driverId` int NULL;
--> statement-breakpoint
ALTER TABLE `order_assignments` ADD CONSTRAINT `order_assignments_driver_fk` FOREIGN KEY (`driverId`) REFERENCES `drivers`(`id`) ON DELETE SET NULL;
