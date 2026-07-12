-- Product catalog extensions + country-specific ProductOffer table.
-- Goal: store sellable offers (retailer, price, currency, stock, URL) separately from product identity.
-- Core recommendations should only use products with a verified offer for the selected shipping country.

-- ---------------------------------------------------------------------------
-- Optional catalog columns on existing products (non-breaking)
-- ---------------------------------------------------------------------------
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS full_ingredients text[] DEFAULT NULL;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS usage_area text DEFAULT NULL;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS texture text DEFAULT NULL;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS fragrance_free boolean DEFAULT NULL;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS alcohol_free boolean DEFAULT NULL;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS verified_at timestamptz DEFAULT NULL;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS data_confidence text DEFAULT NULL;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

-- ---------------------------------------------------------------------------
-- product_offers: one product → many country/retailer offers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- products.id 타입(uuid/text)에 맞춰 text 로 저장. FK는 타입 확인 후 추가 가능.
  product_id text NOT NULL,
  retailer_name text NOT NULL,
  retailer_country text NOT NULL CHECK (retailer_country IN ('KR', 'US', 'JP', 'GLOBAL')),
  ships_to_countries text[] NOT NULL DEFAULT '{}',
  purchase_url text NOT NULL,
  price numeric DEFAULT NULL,
  currency text DEFAULT NULL CHECK (currency IS NULL OR currency IN ('KRW', 'USD', 'JPY')),
  stock_status text NOT NULL DEFAULT 'unknown'
    CHECK (stock_status IN ('in_stock', 'out_of_stock', 'unknown')),
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('verified', 'unverified', 'invalid', 'unavailable')),
  is_official boolean DEFAULT false,
  verified_at timestamptz DEFAULT NULL,
  last_checked_at timestamptz DEFAULT NULL,
  -- Future review extension (not used in ranking yet)
  rating numeric DEFAULT NULL,
  review_count integer DEFAULT NULL,
  source text DEFAULT NULL,
  last_review_sync_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_offers_product_id_idx
  ON product_offers (product_id);

CREATE INDEX IF NOT EXISTS product_offers_country_verified_idx
  ON product_offers (retailer_country, verification_status);

CREATE INDEX IF NOT EXISTS product_offers_ships_to_gin_idx
  ON product_offers USING gin (ships_to_countries);

-- Anon read for client-side recommendation (same pattern as products)
ALTER TABLE product_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon read all product_offers" ON product_offers;
CREATE POLICY "Allow anon read all product_offers"
  ON product_offers
  FOR SELECT
  TO anon
  USING (true);

-- ---------------------------------------------------------------------------
-- Data goals (ops checklist, not enforced by DB):
--   KR / US / JP: >= 100 verified offers each
--   Ingredients: panthenol/ceramide/centella/HA/niacinamide >= 15,
--                vitamin C / retinol >= 10, azelaic acid >= 5
-- ---------------------------------------------------------------------------

-- Example insert shape (replace UUIDs after real products exist):
-- INSERT INTO product_offers (
--   product_id, retailer_name, retailer_country, ships_to_countries,
--   purchase_url, price, currency, stock_status, verification_status, is_official, verified_at
-- ) VALUES (
--   '00000000-0000-0000-0000-000000000001',
--   'Olive Young',
--   'KR',
--   ARRAY['KR'],
--   'https://www.oliveyoung.co.kr/example',
--   18900,
--   'KRW',
--   'in_stock',
--   'verified',
--   true,
--   now()
-- );
