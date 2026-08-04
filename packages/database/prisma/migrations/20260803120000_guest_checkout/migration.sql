-- Guest checkout: allow orders without an account.
--
-- Order.userId and Address.userId become nullable so a buyer can complete
-- checkout with just an email. Existing rows are unaffected (all currently
-- have a userId).

-- Drop the FKs before relaxing the columns, then re-add them.
ALTER TABLE `Order` DROP FOREIGN KEY `Order_userId_fkey`;
ALTER TABLE `Address` DROP FOREIGN KEY `Address_userId_fkey`;

ALTER TABLE `Order`
    MODIFY `userId` VARCHAR(191) NULL,
    ADD COLUMN `guestEmail` VARCHAR(191) NULL,
    ADD COLUMN `guestToken` VARCHAR(191) NULL;

ALTER TABLE `Address`
    MODIFY `userId` VARCHAR(191) NULL;

CREATE UNIQUE INDEX `Order_guestToken_key` ON `Order`(`guestToken`);
CREATE INDEX `Order_guestEmail_idx` ON `Order`(`guestEmail`);

ALTER TABLE `Order`
    ADD CONSTRAINT `Order_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `Address`
    ADD CONSTRAINT `Address_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
