-- Adds a low-stock threshold to supplier catalog items so suppliers get the
-- same low-stock warnings shop owners already get on their products.
-- Paste in Supabase Studio → SQL Editor and run once.

ALTER TABLE supplier_catalog
  ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 10;

-- Backfill existing rows so the column is never null.
UPDATE supplier_catalog SET low_stock_threshold = 10 WHERE low_stock_threshold IS NULL;
