ALTER TABLE `catalog_items`
  ADD COLUMN `stockQuantity` INT NOT NULL DEFAULT 0,
  ADD COLUMN `stockInitialQuantity` INT NOT NULL DEFAULT 0,
  ADD COLUMN `stockAlertPercent` INT NOT NULL DEFAULT 20;

ALTER TABLE `inventory_movements`
  MODIFY COLUMN `reason` ENUM('purchase','adjustment','order_reserved','order_released','order_completed') NOT NULL;
