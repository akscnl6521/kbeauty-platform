
INSERT INTO public.product_discovery_candidates (
  discovered_name, discovered_brand, discovered_url, discovered_country,
  source_type, workflow_status,
  sale_check_status, ingredient_check_status, evidence_check_status,
  safety_check_status, duplicate_check_status, notes, discovered_at
)
VALUES (
        'Hydrium Centella Aqua Soothing Ampoule',
        'COSRX',
        'https://www.cosrx.com/products/hydrium-centella-aqua-soothing-ampoule',
        'KR',
        'official_brand_page',
        'discovered',
        'pending',
        'pass',
        'pending',
        'pending',
        'pass',
        '{"sprint":"wq-f-catalog-remaining","externalProductId":"wqf:cosrx:products-hydrium-centella-aqua-soothing-ampoule","qualityStatus":"staging_ready","hasIngredients":true,"hasImage":true,"hasOffer":true,"active":false,"verified_at":null,"verification_status":"needs_review"}',
        now()
      )
ON CONFLICT (discovered_url) WHERE discovered_url IS NOT NULL
DO UPDATE SET
  notes = EXCLUDED.notes,
  workflow_status = CASE
    WHEN public.product_discovery_candidates.workflow_status IN ('published','verified','rejected')
      THEN public.product_discovery_candidates.workflow_status
    ELSE EXCLUDED.workflow_status
  END;
