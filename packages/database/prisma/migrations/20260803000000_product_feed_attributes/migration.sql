-- Product-feed attributes for the Meta catalogue / Google Shopping.
-- All nullable so existing products remain valid; items missing them still
-- appear in the feed, just with weaker targeting.
ALTER TABLE `Product`
    ADD COLUMN `gender` ENUM('MALE', 'FEMALE', 'UNISEX') NULL,
    ADD COLUMN `ageGroup` ENUM('NEWBORN', 'INFANT', 'TODDLER', 'KIDS', 'ADULT') NULL,
    ADD COLUMN `googleProductCategory` VARCHAR(191) NULL;
