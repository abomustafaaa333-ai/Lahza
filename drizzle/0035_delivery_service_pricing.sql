ALTER TABLE `system_settings`
  ADD COLUMN `manbijStorePricePerKm` INT NOT NULL DEFAULT 2,
  ADD COLUMN `manbijStoreMinutesPerKm` INT NOT NULL DEFAULT 5,
  ADD COLUMN `jarabulusStorePricePerKm` INT NOT NULL DEFAULT 2,
  ADD COLUMN `jarabulusStoreMinutesPerKm` INT NOT NULL DEFAULT 5,
  ADD COLUMN `jarabulusGatewayPricePerKm` INT NOT NULL DEFAULT 2,
  ADD COLUMN `jarabulusGatewayMinutesPerKm` INT NOT NULL DEFAULT 15,
  ADD COLUMN `wosselLiMinutesPerKm` INT NOT NULL DEFAULT 5;
