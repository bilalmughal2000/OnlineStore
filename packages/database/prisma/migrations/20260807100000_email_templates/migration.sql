-- Admin-editable transactional email copy. A missing row (or isEnabled = false)
-- falls back to the built-in default, so a bad edit is always reversible.
CREATE TABLE `EmailTemplate` (
    `key` VARCHAR(191) NOT NULL,
    `subject` TEXT NOT NULL,
    `html` TEXT NOT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT true,
    `updatedAt` DATETIME(3) NOT NULL,
    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
