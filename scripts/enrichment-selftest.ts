/**
 * Enrichment + domain quiz rank selftests (no live network).
 * npx tsx scripts/enrichment-selftest.ts
 */
import assert from "node:assert/strict";
import {
  classifyProvenance,
  enrichOfficialUrl,
  stagingStatusFor,
} from "@/lib/catalog/enrichment";
import {
  rankMascaraProducts,
  rankLipProducts,
  rankBaseMakeupByUndertone,
} from "@/lib/catalog/makeup";
import { rankScalpProducts } from "@/lib/catalog/scalpHair/rankScalpHair";
import { buildFixtureDocument } from "@/lib/catalog/automation/jsonLdParser";

async function main() {
  assert.equal(
    classifyProvenance({
      curatedProvenance: "category_discovery",
      name: "x 발견 후보",
    }),
    "placeholder"
  );
  assert.equal(
    stagingStatusFor("rejected_candidate"),
    "rejected"
  );
  assert.equal(stagingStatusFor("official_matched"), "source_verified");

  const rejected = await enrichOfficialUrl({
    externalProductId: "cosrx-discovery-toner",
    brand: "COSRX",
    brandIdHint: "cosrx",
    nameRaw: "toner discovery",
    category: "toner",
    officialUrl: "https://cosrx.co.kr/collections/all?q=toner",
    curatedProvenance: "category_discovery",
  });
  assert.equal(rejected.matchClass, "rejected_candidate");

  const html = `
<html><script type="application/ld+json">
{"@type":"Product","name":"Test Serum","image":["https://example.com/a.jpg"],
"offers":{"@type":"Offer","price":"12000","priceCurrency":"KRW","availability":"https://schema.org/InStock","url":"https://cosrx.co.kr/products/test"},
"ingredients":"Aqua, Niacinamide, Panthenol"}
</script></html>`;

  const fixtureFetch: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("robots.txt")) {
      return new Response("User-agent: *\nAllow: /\n", { status: 200 });
    }
    if (url.includes("/products/")) {
      return new Response(html, {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }
    if (url.includes("example.com/a.jpg")) {
      return new Response(null, { status: 200 });
    }
    return new Response("no", { status: 404 });
  };

  const matched = await enrichOfficialUrl({
    externalProductId: "cosrx-test-serum",
    brand: "COSRX",
    brandIdHint: "cosrx",
    nameRaw: "COSRX Test Serum",
    category: "serum",
    officialUrl: "https://www.cosrx.co.kr/products/test-serum",
    curatedProvenance: "known_hero",
    fetchImpl: fixtureFetch,
  });
  assert.equal(matched.matchClass, "official_matched");
  assert.ok(matched.fullIngredients.includes("Niacinamide"));
  assert.equal(matched.imageStatus, "remote_reference");
  assert.ok(matched.evidenceSlugs.includes("niacinamide"));

  // Domain quizzes rank divergence
  const mascara = rankMascaraProducts(
    { wantCurl: true, waterproof: true },
    [
      { id: "a", category: "mascara", waterproof: true, mascaraEffects: ["curl"] },
      { id: "b", category: "mascara", waterproof: false, mascaraEffects: ["volume"] },
    ]
  );
  assert.equal(mascara[0]?.product.id, "a");

  const lip = rankLipProducts(
    { undertone: "cool", finish: "matte" },
    [
      { id: "c", category: "lip_tint", undertoneFit: ["cool"], finish: "matte", lipEffects: ["matte"] },
      { id: "w", category: "lip_tint", undertoneFit: ["warm"], finish: "glossy", lipEffects: ["gloss"] },
    ]
  );
  assert.equal(lip[0]?.product.id, "c");

  const base = rankBaseMakeupByUndertone(
    { undertone: "warm", coverage: "medium" },
    [
      { id: "cw", category: "cushion", undertoneFit: ["warm"], coverage: "medium" },
      { id: "cc", category: "cushion", undertoneFit: ["cool"], coverage: "full" },
    ]
  );
  assert.equal(base[0]?.product.id, "cw");

  const scalp = rankScalpProducts(
    { scalpType: "oily" },
    [
      { id: "o", category: "oily_scalp_shampoo", scalpTypes: ["oily"] },
      { id: "s", category: "sensitive_scalp_shampoo", scalpTypes: ["sensitive"] },
    ]
  );
  assert.equal(scalp[0]?.product.id, "o");

  // unused import guard
  void buildFixtureDocument;

  console.log(JSON.stringify({ ok: true }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
