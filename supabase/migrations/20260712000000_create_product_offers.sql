-- Product catalog extensions + country-specific ProductOffer table.
-- Goal: store sellable offers (retailer, price, currency, stock, URL) separately from product identity.
-- Core recommendations should only use products with a verified offer for the selected shipping country.
--
-- Remote compatibility (confirmed read-only):
--   public.products.id = bigint (IDENTITY ALWAYS)
--   public.product_offers does not exist yet
-- Therefore product_offers.product_id is bigint REFERENCES public.products(id).
--
-- Client visibility (minimum privilege):
--   anon/authenticated SELECT only when
--     active = true AND verification_status = 'verified' AND stock_status = 'in_stock'
--   unverified / inactive / out_of_stock / unknown stock are hidden from clients.
--   service_role bypasses RLS for admin verification work (Supabase default).

-- ---------------------------------------------------------------------------
-- Optional catalog columns on existing products (non-breaking)
-- Does not modify existing row values beyond default for new columns.
-- ---------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS full_ingredients text[] DEFAULT NULL;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS usage_area text DEFAULT NULL;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS texture text DEFAULT NULL;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS fragrance_free boolean DEFAULT NULL;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS alcohol_free boolean DEFAULT NULL;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS verified_at timestamptz DEFAULT NULL;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS data_confidence text DEFAULT NULL;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

-- ---------------------------------------------------------------------------
-- product_offers: one product → many country/retailer offers
-- product_id matches remote public.products.id (bigint) with FK.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id bigint NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  retailer_name text NOT NULL,
  retailer_country text NOT NULL
    CHECK (retailer_country IN ('KR', 'US', 'JP', 'GLOBAL')),
  ships_to_countries text[] NOT NULL DEFAULT '{}',
  purchase_url text NOT NULL,
  price numeric DEFAULT NULL,
  currency text DEFAULT NULL
    CHECK (currency IS NULL OR currency IN ('KRW', 'USD', 'JPY')),
  stock_status text NOT NULL DEFAULT 'unknown'
    CHECK (stock_status IN ('in_stock', 'out_of_stock', 'unknown')),
  verification_status text NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('verified', 'unverified', 'invalid', 'unavailable')),
  is_official boolean DEFAULT false,
  verified_at timestamptz DEFAULT NULL,
  last_checked_at timestamptz DEFAULT NULL,
  -- App eligibility uses active !== false; default true so new offers remain includable when verified.
  active boolean NOT NULL DEFAULT true,
  -- Future review extension (not used in ranking yet)
  rating numeric DEFAULT NULL,
  review_count integer DEFAULT NULL,
  source text DEFAULT NULL,
  last_review_sync_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_offers_product_id_idx
  ON public.product_offers (product_id);

CREATE INDEX IF NOT EXISTS product_offers_country_verified_idx
  ON public.product_offers (retailer_country, verification_status);

CREATE INDEX IF NOT EXISTS product_offers_ships_to_gin_idx
  ON public.product_offers USING gin (ships_to_countries);

-- ---------------------------------------------------------------------------
-- RLS + table privileges (minimum privilege for clients)
-- ---------------------------------------------------------------------------
ALTER TABLE public.product_offers ENABLE ROW LEVEL SECURITY;

-- Idempotent policy maintenance uses ALTER when present and CREATE otherwise.
-- SELECT only for anon + authenticated. Pending verification rows stay hidden.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_offers'
      AND policyname = 'Allow anon read all product_offers'
  ) THEN
    ALTER POLICY "Allow anon read all product_offers"
      ON public.product_offers
      TO anon, authenticated
      USING (
        active = true
        AND verification_status = 'verified'
        AND stock_status = 'in_stock'
      );
  ELSE
    CREATE POLICY "Allow anon read all product_offers"
      ON public.product_offers
      FOR SELECT
      TO anon, authenticated
      USING (
        active = true
        AND verification_status = 'verified'
        AND stock_status = 'in_stock'
      );
  END IF;
END $$;

-- Explicitly remove client write privileges; keep SELECT only.
-- service_role is unchanged (admin / server-side work).
REVOKE INSERT, UPDATE, DELETE ON public.product_offers FROM anon, authenticated;
GRANT SELECT ON public.product_offers TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Data goals (ops checklist, not enforced by DB):
--   KR / US / JP: >= 100 verified offers each
--   Ingredients: panthenol/ceramide/centella/HA/niacinamide >= 15,
--                vitamin C / retinol >= 10, azelaic acid >= 5
--
-- KR verified offer eligibility (app-side, supported by columns above):
--   retailer_country = 'KR'
--   ships_to_countries includes 'KR'
--   currency = 'KRW'
--   price > 0
--   stock_status = 'in_stock'
--   verification_status = 'verified'
--   purchase_url https
--   verified_at present
--   active !== false
-- ---------------------------------------------------------------------------

-- Example insert shape (use a real public.products.id bigint value):
-- INSERT INTO public.product_offers (
--   product_id, retailer_name, retailer_country, ships_to_countries,
--   purchase_url, price, currency, stock_status, verification_status,
--   is_official, verified_at, active
-- ) VALUES (
--   1,
--   'Olive Young',
--   'KR',
--   ARRAY['KR']::text[],
--   'https://www.oliveyoung.co.kr/example',
--   18900,
--   'KRW',
--   'in_stock',
--   'verified',
--   true,
--   now(),
--   true
-- );
