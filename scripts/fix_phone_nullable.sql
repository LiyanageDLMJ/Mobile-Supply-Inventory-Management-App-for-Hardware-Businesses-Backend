-- Fix phone columns to allow NULL (phone is optional at registration).
-- Paste this in Supabase Studio → SQL Editor and run once.

ALTER TABLE suppliers ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE shops     ALTER COLUMN phone DROP NOT NULL;

-- Clean up the empty-string placeholders we inserted as a temporary workaround.
UPDATE suppliers SET phone = NULL WHERE phone = '';
UPDATE shops     SET phone = NULL WHERE phone = '';
