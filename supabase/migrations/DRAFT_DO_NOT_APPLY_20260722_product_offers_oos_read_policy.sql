-- DRAFT — DO NOT APPLY
-- Phase 2.6 finding: anon RLS hides official KR OOS/unverified offers,
-- so commerce_status falls back to availability_unknown even when Staging
-- has a real out_of_stock official offer (e.g. BOJ green plum toner).
--
-- Goal: allow public SELECT of official sale-checked OOS/unknown rows
-- without exposing invalid offers or inventing in_stock.
--
-- Production / Staging apply: requires explicit human approval.
-- This file must not be auto-applied.

BEGIN;

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
        AND (
          (
            verification_status = 'verified'
            AND stock_status = 'in_stock'
          )
          OR (
            is_official = true
            AND stock_status IN ('out_of_stock', 'unknown')
            AND verification_status IN ('verified', 'unverified')
            AND retailer_country IN ('KR', 'US', 'JP')
            AND price IS NOT NULL
            AND price > 0
            AND currency IS NOT NULL
            AND purchase_url LIKE 'https://%'
          )
        )
      );
  END IF;
END $$;

COMMIT;
