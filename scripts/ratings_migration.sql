-- Verified transaction rating system
-- Run in Supabase Dashboard > SQL Editor before using the rating endpoints.

CREATE TABLE IF NOT EXISTS ratings (
  id SERIAL PRIMARY KEY,
  reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('SHOP', 'SUPPLIER')),
  shop_id INTEGER REFERENCES shops(id) ON DELETE CASCADE,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
  reservation_id INTEGER REFERENCES reservations(id) ON DELETE CASCADE,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  stars SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment VARCHAR(500),
  is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
  moderated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  moderation_reason VARCHAR(500),
  moderated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT ratings_target_matches_transaction CHECK (
    (
      target_type = 'SHOP'
      AND shop_id IS NOT NULL
      AND reservation_id IS NOT NULL
      AND supplier_id IS NULL
      AND order_id IS NULL
    )
    OR
    (
      target_type = 'SUPPLIER'
      AND supplier_id IS NOT NULL
      AND order_id IS NOT NULL
      AND shop_id IS NULL
      AND reservation_id IS NULL
    )
  )
);

-- Safe upgrade for projects where the original ratings table already exists.
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS moderated_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS moderation_reason VARCHAR(500);
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMP;

-- A completed transaction can be reviewed only once, even under concurrent requests.
CREATE UNIQUE INDEX IF NOT EXISTS ratings_one_per_reservation
  ON ratings(reservation_id) WHERE reservation_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ratings_one_per_order
  ON ratings(order_id) WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ratings_shop_summary ON ratings(shop_id);
CREATE INDEX IF NOT EXISTS ratings_supplier_summary ON ratings(supplier_id);
CREATE INDEX IF NOT EXISTS ratings_reviewer ON ratings(reviewer_id);

-- No client policy is intentionally created. The Express backend uses its
-- server-only Supabase key and is the sole gateway for rating operations.
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
