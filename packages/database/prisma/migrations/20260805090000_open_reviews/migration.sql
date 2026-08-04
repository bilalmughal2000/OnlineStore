-- Reviews may be left without an account.
--
-- userId becomes nullable and guestName carries the display name for anonymous
-- reviews. The unique index on (productId, userId) is kept: it still enforces
-- one review per account per product, and MySQL allows repeated NULLs in a
-- unique index, so anonymous reviews are unaffected by it.

ALTER TABLE `Review` DROP FOREIGN KEY `Review_userId_fkey`;

ALTER TABLE `Review`
    MODIFY `userId` VARCHAR(191) NULL,
    ADD COLUMN `guestName` VARCHAR(191) NULL;

ALTER TABLE `Review`
    ADD CONSTRAINT `Review_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
