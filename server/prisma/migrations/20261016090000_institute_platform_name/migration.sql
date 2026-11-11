-- Rebrand the platform from the placeholder "GCR" to the institute's name.
-- Only rewrites the settings row if an admin hasn't already renamed it.
ALTER TABLE "SystemSettings" ALTER COLUMN "platformName" SET DEFAULT 'Elevate Institute of Tourism & Hospitality Management';

UPDATE "SystemSettings"
SET "platformName" = 'Elevate Institute of Tourism & Hospitality Management'
WHERE "platformName" = 'GCR';
