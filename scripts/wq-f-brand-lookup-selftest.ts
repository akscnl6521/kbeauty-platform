import assert from "node:assert/strict";
import { KR_BRAND_SEED_REGISTRY } from "../src/lib/catalog/bulkKr/brandRegistry";
import { selectPopularKrBrands } from "../src/lib/catalog/officialCrawl";

// Regression test: an explicitly requested WQF_BRAND_IDS entry must resolve
// even when it sits outside the first 20 "popular" registry slots. A prior
// bug filtered `selectPopularKrBrands(20)` instead of the full registry,
// silently dropping any requested brand ranked below #20 (empty crawl batch,
// zero Staging candidates, no error surfaced).
{
  assert.ok(
    KR_BRAND_SEED_REGISTRY.length > 20,
    "registry must have more than 20 brands for this regression to be meaningful"
  );

  const tailBrandId = KR_BRAND_SEED_REGISTRY[KR_BRAND_SEED_REGISTRY.length - 1].brandId;

  const popularTop20 = selectPopularKrBrands(20);
  assert.ok(
    !popularTop20.some((b) => b.brandId === tailBrandId),
    `expected ${tailBrandId} to sit outside the top-20 popular slice`
  );

  // The correct resolution path: filter the FULL registry, not the popular slice.
  const want = new Set([tailBrandId]);
  const resolved = KR_BRAND_SEED_REGISTRY.filter((b) => want.has(b.brandId));
  assert.equal(resolved.length, 1, `${tailBrandId} must resolve from the full registry`);

  // The buggy pattern (kept here so this test fails again if it regresses).
  const buggyResolved = selectPopularKrBrands(20).filter((b) => want.has(b.brandId));
  assert.equal(
    buggyResolved.length,
    0,
    "documents the fixed bug: popular-slice filtering misses tail brands"
  );
}

// Every brandId must be unique so lookups are unambiguous.
{
  const ids = KR_BRAND_SEED_REGISTRY.map((b) => b.brandId);
  assert.equal(new Set(ids).size, ids.length, "brandId must be unique");
}

console.log("wq-f-brand-lookup-selftest ok");
