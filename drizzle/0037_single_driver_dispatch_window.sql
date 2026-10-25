-- The column is normally created at runtime (ensureDriverDispatchSchema), but on
-- an empty database migrations run first, so create it here when it is missing.
SET @lahza_dispatch_col := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'system_settings' AND column_name = 'driverDispatchTimeoutMinutes');
SET @lahza_dispatch_sql := IF(@lahza_dispatch_col = 0,
  'ALTER TABLE `system_settings` ADD COLUMN `driverDispatchTimeoutMinutes` INT NOT NULL DEFAULT 15',
  'ALTER TABLE `system_settings` MODIFY COLUMN `driverDispatchTimeoutMinutes` INT NOT NULL DEFAULT 15');
PREPARE lahza_dispatch_stmt FROM @lahza_dispatch_sql;
EXECUTE lahza_dispatch_stmt;
DEALLOCATE PREPARE lahza_dispatch_stmt;
UPDATE `system_settings` SET `driverDispatchTimeoutMinutes` = 15;
