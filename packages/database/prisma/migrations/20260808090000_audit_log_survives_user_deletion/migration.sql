-- The audit trail must outlive the account it describes.
--
-- adminId was NOT NULL with a RESTRICT foreign key, which made a staff member
-- who had ever performed an action undeletable. Cascading instead would delete
-- their history along with them — the opposite of what an audit log is for.
--
-- So: keep the row, null the link, and carry the actor's identity on the row.

ALTER TABLE `AdminActivityLog`
  ADD COLUMN `adminName` VARCHAR(191) NOT NULL DEFAULT '',
  ADD COLUMN `adminEmail` VARCHAR(191) NOT NULL DEFAULT '';

-- Backfill existing rows from the accounts that are still present.
UPDATE `AdminActivityLog` l
  JOIN `User` u ON u.`id` = l.`adminId`
  SET l.`adminName` = u.`name`, l.`adminEmail` = u.`email`;

ALTER TABLE `AdminActivityLog` MODIFY `adminId` VARCHAR(191) NULL;

ALTER TABLE `AdminActivityLog` DROP FOREIGN KEY `AdminActivityLog_adminId_fkey`;
ALTER TABLE `AdminActivityLog`
  ADD CONSTRAINT `AdminActivityLog_adminId_fkey`
  FOREIGN KEY (`adminId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- The log is always read newest-first.
CREATE INDEX `AdminActivityLog_createdAt_idx` ON `AdminActivityLog`(`createdAt`);
