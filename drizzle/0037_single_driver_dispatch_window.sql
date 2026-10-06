ALTER TABLE `system_settings` MODIFY COLUMN `driverDispatchTimeoutMinutes` INT NOT NULL DEFAULT 15;
UPDATE `system_settings` SET `driverDispatchTimeoutMinutes` = 15;
