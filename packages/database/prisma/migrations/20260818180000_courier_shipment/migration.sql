-- AlterTable: courier / shipment tracking on the order
ALTER TABLE `Order` ADD COLUMN `courier` VARCHAR(191) NULL,
    ADD COLUMN `trackingNumber` VARCHAR(191) NULL,
    ADD COLUMN `courierStatus` VARCHAR(191) NULL,
    ADD COLUMN `courierBookedAt` DATETIME(3) NULL,
    ADD COLUMN `courierSyncedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `Order_trackingNumber_idx` ON `Order`(`trackingNumber`);
