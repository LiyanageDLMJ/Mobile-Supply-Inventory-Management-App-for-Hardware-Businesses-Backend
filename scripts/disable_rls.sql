-- Run this in Supabase Dashboard > SQL Editor
-- Disables RLS on tables the backend writes to. Safe for this project because
-- the Express backend already enforces auth + role checks via JWT middleware.

ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

-- (The other tables below already had RLS off when they were created via the
-- original pg setup script. These ALTERs are no-ops if RLS is already disabled
-- but make the state explicit and protect against future re-enables.)
ALTER TABLE users             DISABLE ROW LEVEL SECURITY;
ALTER TABLE shops             DISABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers         DISABLE ROW LEVEL SECURITY;
ALTER TABLE products          DISABLE ROW LEVEL SECURITY;
ALTER TABLE reservations      DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders            DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items       DISABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_catalog  DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments          DISABLE ROW LEVEL SECURITY;
