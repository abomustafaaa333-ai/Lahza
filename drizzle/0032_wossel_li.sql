ALTER TABLE `orders` MODIFY COLUMN `orderType` ENUM('delivery','taxi','wossel_li') NOT NULL;
ALTER TABLE `orders` ADD COLUMN `pickupContactPhone` varchar(24) NULL;
ALTER TABLE `orders` ADD COLUMN `itemDescription` varchar(500) NULL;
ALTER TABLE `orders` ADD COLUMN `itemWeight` varchar(80) NULL;
ALTER TABLE `system_settings` ADD COLUMN `wosselLiPricePerKm` int NOT NULL DEFAULT 2;
