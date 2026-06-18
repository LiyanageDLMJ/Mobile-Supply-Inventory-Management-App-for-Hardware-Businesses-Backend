-- =====================================================================
-- VERIFICATION SYSTEM MIGRATION
-- Paste this into Supabase Studio → SQL Editor → Run.
-- Safe to run multiple times (uses IF NOT EXISTS).
-- =====================================================================

-- 1) Add verification columns to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS verification_status TEXT
    DEFAULT 'NOT_SUBMITTED'
    CHECK (verification_status IN ('NOT_SUBMITTED', 'PENDING', 'VERIFIED', 'REJECTED'));

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS verification_docs JSONB;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS verified_by INTEGER;

-- 2) Set sensible defaults for existing users:
--    Customers and admins do not need verification → mark VERIFIED.
--    Existing shop owners / suppliers stay NOT_SUBMITTED so they can
--    upload docs and get reviewed.
UPDATE users SET verification_status = 'VERIFIED'
 WHERE role IN ('CUSTOMER', 'ADMIN') AND verification_status = 'NOT_SUBMITTED';

-- 3) Index for admin "show pending" query
CREATE INDEX IF NOT EXISTS idx_users_verification_status
  ON users(verification_status);

-- 4) Optional: notification type doesn't need schema change
--    (notifications.type is already a free TEXT/VARCHAR column).
-- =====================================================================
