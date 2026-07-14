/**
 * Staging-only: COSRX catalog JSON (3) → Search-to-Verified first cases.
 *
 * Safety:
 * - Abort on Production ref/URL
 * - Never UPDATE products (body/image/ingredients untouched for ids 4~11)
 * - Never set Verified / products.verified_at
 * - No DROP/TRUNCATE/DELETE
 * - New candidates only when official COSRX source URL is present
 * - Idempotent: URL unique, provenance hash, skip no-op updates
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertStagingCatalogWriteAllowed } from "@/lib/admin/stagingWriteGate";
import { KNOWN_PRODUCTION_SUPABASE_REF } from "@/lib/catalog/automation/ingestionGate";

const ROOT = process.cwd();
const OUT = path.join(
  ROOT,
  "data/catalog-import/2026-07-cosrx-search-to-verified"
);
const CASE_TAG = "[s2v-case:2026-07-cosrx-catalog-json]";
const SOURCE_TYPE = "official_retailer";
const PROTECTED_IDS = [4, 5, 6, 7, 8, 9, 10, 11];

type CatalogProduct = {
  productId: string;
  canonicalBrandName: string;
  productNameKo: string;
  productNameEn: string;
  category: string;
  keyIngredients: unknown[];
  fullIngredients: unknown[];
  dataConfidence: string | null;
  verifiedAt: string | null;
  sourceUrl: string;
  notes?: string;
};

type CatalogOffer = {
  offerId: string;
  productId: string;
  retailerName: string;
  retailerCountry: string;
  shipsToCountries: string[];
  purchaseUrl: string;
  price: number;
  currency: string;
  stockStatus: string;
  verificationStatus: string;
  isOfficial: boolean;
  verifiedAt: string | null;
  active: boolean;
};

type StagingProduct = {
  id: number;
  slug: string;
  brand: string | null;
  name: string | null;
  full_ingredients: string[] | null;
  key_ingredients: string[] | null;
  verified_at: string | null;
  data_confidence: string | null;
  active: boolean | null;
};

function sha(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isOfficialCosrxUrl(u: string | null | undefined): boolean {
  if (!u) return false;
  return (
    /^https:\/\/(www\.)?cosrx\.co\.kr\//i.test(u) ||
    /^https:\/\/(www\.)?cosrx\.com\//i.test(u)
  );
}

function matchProduct(
  catalog: CatalogProduct,
  products: StagingProduct[]
): { match: StagingProduct | null; reason: string } {
  const en = normName(catalog.productNameEn);
  const id = catalog.productId.toLowerCase();

  if (id.includes("snail-96") || en.includes("snail 96")) {
    const hit = products.find(
      (p) =>
        (p.slug || "").includes("snail-96") ||
        normName(p.name || "").includes("snail 96")
    );
    return hit
      ? { match: hit, reason: "name_or_slug_snail_96" }
      : { match: null, reason: "no_staging_snail_96" };
  }
  if (id.includes("snail-92") || en.includes("snail 92")) {
    const hit = products.find(
      (p) =>
        (p.slug || "").includes("snail-92") ||
        normName(p.name || "").includes("snail 92")
    );
    return hit
      ? { match: hit, reason: "name_or_slug_snail_92" }
      : { match: null, reason: "no_staging_snail_92" };
  }
  if (id.includes("blemish") || en.includes("blemish")) {
    const hit = products.find(
      (p) =>
        (p.slug || "").includes("blemish") ||
        normName(p.name || "").includes("blemish")
    );
    return hit
      ? { match: hit, reason: "name_or_slug_blemish_pad" }
      : { match: null, reason: "no_staging_blemish_pad" };
  }
  const exact = products.find((p) => normName(p.name || "") === en);
  if (exact) return { match: exact, reason: "exact_name" };
  return { match: null, reason: "no_match" };
}

function productFingerprint(p: StagingProduct) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    verified_at: p.verified_at,
    data_confidence: p.data_confidence,
    active: p.active,
    full_count: p.full_ingredients?.length ?? 0,
    key_count: p.key_ingredients?.length ?? 0,
    full_hash: sha(JSON.stringify(p.full_ingredients ?? [])),
    key_hash: sha(JSON.stringify(p.key_ingredients ?? [])),
  };
}

async function countTagged(client: SupabaseClient) {
  const tables = [
    "product_discovery_candidates",
    "verification_queue",
    "product_change_history",
    "product_offers",
  ] as const;
  const out: Record<string, number> = {};
  for (const t of tables) {
    let q = client.from(t).select("id", { count: "exact", head: true });
    if (t === "product_discovery_candidates") {
      q = q.ilike("notes", `%${CASE_TAG}%`);
    } else if (t === "verification_queue") {
      q = q.ilike("reason", `%${CASE_TAG}%`);
    } else if (t === "product_change_history") {
      q = q.eq("change_type", "source").ilike("source_url", "%cosrx.co.kr%");
    } else if (t === "product_offers") {
      q = q.eq("source", CASE_TAG);
    }
    const { count, error } = await q;
    if (error) throw new Error(`count_${t}:${error.message}`);
    out[t] = count ?? 0;
  }

  const { count: provCount, error: provErr } = await client
    .from("product_field_provenance")
    .select("id", { count: "exact", head: true })
    .eq("extraction_method", "catalog_json_s2v_case");
  if (provErr) throw new Error(`count_provenance:${provErr.message}`);
  out.product_field_provenance = provCount ?? 0;

  const { count: dsCount, error: dsErr } = await client
    .from("data_sources")
    .select("id", { count: "exact", head: true })
    .eq("source_type", SOURCE_TYPE)
    .eq("base_url", "https://www.cosrx.co.kr");
  if (dsErr) throw new Error(`count_data_sources:${dsErr.message}`);
  out.data_sources_cosrx_kr = dsCount ?? 0;

  const { count: productsTotal, error: pErr } = await client
    .from("products")
    .select("id", { count: "exact", head: true });
  if (pErr) throw new Error(`count_products:${pErr.message}`);
  out.products_total = productsTotal ?? 0;

  return out;
}

async function loadProtected(
  client: SupabaseClient
): Promise<Record<number, ReturnType<typeof productFingerprint>>> {
  const { data, error } = await client
    .from("products")
    .select(
      "id, slug, brand, name, full_ingredients, key_ingredients, verified_at, data_confidence, active"
    )
    .in("id", PROTECTED_IDS);
  if (error) throw new Error(`protected_load:${error.message}`);
  const map: Record<number, ReturnType<typeof productFingerprint>> = {};
  for (const row of (data ?? []) as StagingProduct[]) {
    map[row.id] = productFingerprint(row);
  }
  return map;
}

async function main() {
  const ref = (process.env.SUPABASE_PROJECT_REF || "").trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!ref || ref === KNOWN_PRODUCTION_SUPABASE_REF) {
    throw new Error("ABORT: Staging required");
  }
  if (url.includes(KNOWN_PRODUCTION_SUPABASE_REF)) {
    throw new Error("ABORT: Production URL");
  }
  const gate = assertStagingCatalogWriteAllowed();
  if (!gate.ok) throw new Error(gate.code);
  if (!key) throw new Error("SERVICE_ROLE_MISSING");

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const productsRaw = JSON.parse(
    fs.readFileSync(path.join(OUT, "input/cosrx-products.json"), "utf8")
  ) as { products: CatalogProduct[] };
  const offersRaw = JSON.parse(
    fs.readFileSync(path.join(OUT, "input/cosrx-offers.json"), "utf8")
  ) as { offers: CatalogOffer[] };

  const offersByProduct = new Map<string, CatalogOffer>();
  for (const o of offersRaw.offers) offersByProduct.set(o.productId, o);

  const normalized = productsRaw.products.map((p) => ({
    catalogProductId: p.productId,
    brand: p.canonicalBrandName,
    nameEn: p.productNameEn,
    nameKo: p.productNameKo,
    category: p.category,
    source_url: p.sourceUrl,
    source_type: SOURCE_TYPE,
    data_confidence: p.dataConfidence,
    verified_at: null,
    full_ingredient_count: p.fullIngredients?.length ?? 0,
    key_ingredient_count: p.keyIngredients?.length ?? 0,
    official_source: isOfficialCosrxUrl(p.sourceUrl),
    offer: offersByProduct.get(p.productId)
      ? {
          offerId: offersByProduct.get(p.productId)!.offerId,
          purchaseUrl: offersByProduct.get(p.productId)!.purchaseUrl,
          stockStatus: offersByProduct.get(p.productId)!.stockStatus,
          verificationStatus:
            offersByProduct.get(p.productId)!.verificationStatus,
        }
      : null,
  }));
  fs.writeFileSync(
    path.join(OUT, "normalized/products.json"),
    JSON.stringify({ caseTag: CASE_TAG, items: normalized }, null, 2),
    "utf8"
  );

  const countsBefore = await countTagged(client);
  const protectedBefore = await loadProtected(client);

  const { data: stagingRows, error: prodErr } = await client
    .from("products")
    .select(
      "id, slug, brand, name, full_ingredients, key_ingredients, verified_at, data_confidence, active"
    )
    .ilike("brand", "COSRX");
  if (prodErr) throw new Error(`products_query:${prodErr.message}`);
  const stagingProducts = (stagingRows ?? []) as StagingProduct[];

  // data_sources (idempotent by type+url)
  const baseUrl = "https://www.cosrx.co.kr";
  let dataSourceId: string | null = null;
  {
    const { data: existing, error: exErr } = await client
      .from("data_sources")
      .select("id")
      .eq("source_type", SOURCE_TYPE)
      .eq("base_url", baseUrl)
      .maybeSingle();
    if (exErr) throw new Error(`data_sources_select:${exErr.message}`);
    if (existing?.id) {
      dataSourceId = existing.id as string;
    } else {
      const { data: inserted, error } = await client
        .from("data_sources")
        .insert({
          source_type: SOURCE_TYPE,
          source_name: "COSRX 공식몰 (KR)",
          base_url: baseUrl,
          country_code: "KR",
          trust_level: "high",
          official: true,
          active: true,
        })
        .select("id")
        .single();
      if (error) throw new Error(`data_sources_insert:${error.message}`);
      dataSourceId = inserted.id as string;
    }
  }

  const perProduct: Array<Record<string, unknown>> = [];
  const applied: Array<Record<string, unknown>> = [];
  let matchedCount = 0;
  let newCandidateCount = 0;
  let needsReviewCount = 0;
  let duplicateBlocked = 0;
  let sourceMissing = 0;
  let candidatesInserted = 0;
  let skippedNoOfficialSource = 0;

  for (const catalog of productsRaw.products) {
    const offer = offersByProduct.get(catalog.productId) ?? null;
    const official = isOfficialCosrxUrl(catalog.sourceUrl);
    if (!catalog.sourceUrl) sourceMissing += 1;

    const reasons: string[] = [];
    if (!official) reasons.push("source_url_not_official_or_missing");
    if ((catalog.fullIngredients?.length ?? 0) === 0) {
      reasons.push("catalog_full_ingredients_empty");
    }
    if (!offer) reasons.push("offer_missing");
    else {
      if (offer.verificationStatus !== "verified") reasons.push("offer_unverified");
      if (offer.stockStatus === "unknown") reasons.push("offer_stock_unknown");
      if (!offer.verifiedAt) reasons.push("offer_verified_at_null");
    }
    reasons.push("auto_verified_forbidden_until_manual_review");

    const { match, reason: matchReason } = matchProduct(
      catalog,
      stagingProducts
    );
    needsReviewCount += 1;
    if (match) {
      matchedCount += 1;
      duplicateBlocked += 1;
      if (
        (match.full_ingredients?.length ?? 0) > 0 &&
        (catalog.fullIngredients?.length ?? 0) === 0
      ) {
        reasons.push(
          "ingredient_source_mismatch_catalog_empty_existing_preserved"
        );
      }
      if (catalog.sourceUrl.includes("cosrx.co.kr")) {
        reasons.push("possible_kr_vs_global_formula_difference_needs_review");
      }
    } else {
      newCandidateCount += 1;
    }

    // New candidate rows only when official source is present.
    // Matched products: always link source/evidence (official URL required).
    let candidateId: string | null = null;
    let candidateCreated = false;
    let candidateAction = "skipped";

    if (!official) {
      skippedNoOfficialSource += 1;
      candidateAction = "skipped_non_official_source";
    } else {
      const { data: existingCand, error: candSelErr } = await client
        .from("product_discovery_candidates")
        .select("id, linked_product_id, notes, workflow_status")
        .eq("discovered_url", catalog.sourceUrl)
        .maybeSingle();
      if (candSelErr) throw new Error(`candidate_select:${candSelErr.message}`);

      if (existingCand?.id) {
        candidateId = existingCand.id as string;
        const patch: Record<string, unknown> = {};
        if (match && !existingCand.linked_product_id) {
          patch.linked_product_id = match.id;
        }
        if (existingCand.workflow_status !== "needs_review") {
          // Never promote to verified here; only ensure needs_review if not rejected/published
          if (
            !["verified", "published", "rejected"].includes(
              String(existingCand.workflow_status)
            )
          ) {
            patch.workflow_status = "needs_review";
          }
        }
        const notes = String(existingCand.notes || "");
        if (!notes.includes(CASE_TAG)) {
          patch.notes = `${notes}\n${CASE_TAG} ${catalog.productId}`.trim();
        }
        if (Object.keys(patch).length > 0) {
          patch.updated_at = new Date().toISOString();
          const { error } = await client
            .from("product_discovery_candidates")
            .update(patch)
            .eq("id", candidateId);
          if (error) throw new Error(`candidate_update:${error.message}`);
          candidateAction = "updated_minimal";
        } else {
          candidateAction = "existing_unchanged";
        }
      } else {
        // Create candidate for official source (matched or unmatched).
        // Never create products row. Always needs_review.
        const { data: inserted, error } = await client
          .from("product_discovery_candidates")
          .insert({
            discovered_name: catalog.productNameEn,
            discovered_brand: catalog.canonicalBrandName,
            discovered_url: catalog.sourceUrl,
            discovered_country: "KR",
            source_type: SOURCE_TYPE,
            workflow_status: "needs_review",
            sale_check_status: "fail",
            ingredient_check_status: "fail",
            evidence_check_status: "pending",
            safety_check_status: "pending",
            duplicate_check_status: match ? "fail" : "pass",
            linked_product_id: match?.id ?? null,
            notes: `${CASE_TAG} ${catalog.productId} | 공식 출처 확인·전성분/재고 미검증 → Verified 금지`,
          })
          .select("id")
          .single();
        if (error) throw new Error(`candidate_insert:${error.message}`);
        candidateId = inserted.id as string;
        candidateCreated = true;
        candidatesInserted += 1;
        candidateAction = "inserted";
      }
    }

    // verification_queue (insert if no open tagged/open item)
    let queueId: string | null = null;
    let queueAction = "skipped";
    if (candidateId) {
      const { data: openItems, error: qSelErr } = await client
        .from("verification_queue")
        .select("id, status, reason")
        .eq("entity_type", "candidate")
        .eq("entity_id", candidateId)
        .in("status", ["pending", "in_review", "needs_review"])
        .limit(5);
      if (qSelErr) throw new Error(`queue_select:${qSelErr.message}`);
      const tagged = (openItems ?? []).find((r) =>
        String((r as { reason?: string }).reason || "").includes(CASE_TAG)
      );
      if (tagged) {
        queueId = tagged.id as string;
        queueAction = "existing_unchanged";
      } else if (openItems && openItems.length > 0) {
        queueId = openItems[0].id as string;
        const reason = `${CASE_TAG} ${reasons.join("; ")}`.slice(0, 1000);
        const { error } = await client
          .from("verification_queue")
          .update({ status: "needs_review", reason })
          .eq("id", queueId);
        if (error) throw new Error(`queue_update:${error.message}`);
        queueAction = "tagged_existing_open";
      } else {
        const { data: inserted, error } = await client
          .from("verification_queue")
          .insert({
            entity_type: "candidate",
            entity_id: candidateId,
            review_type: "other",
            priority: 50,
            status: "needs_review",
            reason: `${CASE_TAG} ${reasons.join("; ")}`.slice(0, 1000),
          })
          .select("id")
          .single();
        if (error) throw new Error(`queue_insert:${error.message}`);
        queueId = inserted.id as string;
        queueAction = "inserted";
      }
    }

    // provenance (idempotent unique hash, ignoreDuplicates)
    const provenanceApplied: string[] = [];
    if (candidateId && official) {
      const fields = [
        { field: "source_url", value: catalog.sourceUrl },
        { field: "product_name_en", value: catalog.productNameEn },
        { field: "catalog_product_id", value: catalog.productId },
        { field: "offer_purchase_url", value: offer?.purchaseUrl || "" },
        { field: "verification_case", value: CASE_TAG },
      ];
      for (const f of fields) {
        if (!f.value) continue;
        const valueHash = sha(`${f.field}|${f.value}`);
        const entityId = match ? String(match.id) : candidateId;
        const entityType = match ? "product" : "candidate";
        const { error } = await client.from("product_field_provenance").upsert(
          {
            entity_type: entityType,
            entity_id: entityId,
            product_id: match?.id ?? null,
            candidate_id: candidateId,
            field_name: f.field,
            value_summary: f.value.slice(0, 200),
            value_hash: valueHash,
            source_url: catalog.sourceUrl,
            source_domain: "www.cosrx.co.kr",
            extraction_method: "catalog_json_s2v_case",
            confidence: 0.7,
            raw_hash: sha(f.value),
            verified_status: "needs_review",
          },
          {
            onConflict: "entity_type,entity_id,field_name,value_hash",
            ignoreDuplicates: true,
          }
        );
        if (error) throw new Error(`provenance:${error.message}`);
        provenanceApplied.push(f.field);
      }
    }

    // change history — source link only, never product body
    let historyId: string | null = null;
    let historyAction = "skipped";
    if (match && official) {
      const { data: histExisting, error: hSelErr } = await client
        .from("product_change_history")
        .select("id")
        .eq("product_id", match.id)
        .eq("change_type", "source")
        .eq("source_url", catalog.sourceUrl)
        .limit(1);
      if (hSelErr) throw new Error(`history_select:${hSelErr.message}`);
      if (histExisting && histExisting.length > 0) {
        historyId = histExisting[0].id as string;
        historyAction = "existing_unchanged";
      } else {
        const { data: hist, error } = await client
          .from("product_change_history")
          .insert({
            product_id: match.id,
            change_type: "source",
            old_value: null,
            new_value: {
              case: CASE_TAG,
              catalogProductId: catalog.productId,
              sourceUrl: catalog.sourceUrl,
              sourceType: SOURCE_TYPE,
              offerId: offer?.offerId ?? null,
              action: "linked_search_to_verified_case",
              product_body_unchanged: true,
            },
            source_url: catalog.sourceUrl,
          })
          .select("id")
          .single();
        if (error) throw new Error(`history_insert:${error.message}`);
        historyId = hist.id as string;
        historyAction = "inserted";
      }
    }

    // unverified offer attach for matched only (never verified)
    let offerRowId: string | null = null;
    let offerAction = "skipped";
    if (match && offer && official) {
      const { data: existingOffers, error: oSelErr } = await client
        .from("product_offers")
        .select("id")
        .eq("product_id", match.id)
        .eq("purchase_url", offer.purchaseUrl)
        .limit(1);
      if (oSelErr) throw new Error(`offer_select:${oSelErr.message}`);
      if (existingOffers && existingOffers.length > 0) {
        offerRowId = existingOffers[0].id as string;
        offerAction = "existing_unchanged";
      } else {
        const { data: ins, error } = await client
          .from("product_offers")
          .insert({
            product_id: match.id,
            retailer_name: offer.retailerName,
            retailer_country: offer.retailerCountry,
            ships_to_countries: offer.shipsToCountries,
            purchase_url: offer.purchaseUrl,
            price: offer.price,
            currency: offer.currency,
            stock_status: "unknown",
            verification_status: "unverified",
            is_official: true,
            verified_at: null,
            last_checked_at: null,
            active: true,
            source: CASE_TAG,
          })
          .select("id")
          .single();
        if (error) throw new Error(`offer_insert:${error.message}`);
        offerRowId = ins.id as string;
        offerAction = "inserted_unverified";
      }
    } else if (!match) {
      offerAction = "deferred_no_product_row";
    }

    const report = {
      catalogProductId: catalog.productId,
      nameEn: catalog.productNameEn,
      source_url: catalog.sourceUrl,
      source_type: SOURCE_TYPE,
      verified_at: null,
      data_confidence: catalog.dataConfidence || "medium",
      needs_review: true,
      verification_status: "needs_review",
      verified_transition: false,
      match: match
        ? {
            productId: match.id,
            slug: match.slug,
            matchReason,
            product_body_mutated: false,
          }
        : null,
      duplicate_product_create_blocked: Boolean(match),
      new_product_created: false,
      evidence: {
        official_source: official,
        reasons,
      },
      applied: {
        dataSourceId,
        candidateId,
        candidateAction,
        candidateCreated,
        queueId,
        queueAction,
        provenanceFields: provenanceApplied,
        historyId,
        historyAction,
        offerRowId,
        offerAction,
      },
    };
    perProduct.push(report);
    applied.push({
      catalogProductId: catalog.productId,
      candidateId,
      linkedProductId: match?.id ?? null,
      queueId,
      offerRowId,
      candidateAction,
      queueAction,
      offerAction,
    });
  }

  const countsAfter = await countTagged(client);
  const protectedAfter = await loadProtected(client);
  const protectedDiff: Array<{ id: number; changed: boolean }> = [];
  for (const id of PROTECTED_IDS) {
    const before = JSON.stringify(protectedBefore[id] ?? null);
    const after = JSON.stringify(protectedAfter[id] ?? null);
    protectedDiff.push({ id, changed: before !== after });
  }
  if (protectedDiff.some((d) => d.changed)) {
    throw new Error("ABORT: protected products 4-11 body changed");
  }
  if (countsAfter.products_total !== countsBefore.products_total) {
    throw new Error("ABORT: products_total changed (unexpected product create)");
  }

  const verificationReport = {
    checked_at: new Date().toISOString(),
    case_tag: CASE_TAG,
    input_json_count: productsRaw.products.length,
    existing_product_match_count: matchedCount,
    new_candidate_count: newCandidateCount,
    verified_transition_count: 0,
    needs_review_count: needsReviewCount,
    duplicate_blocked_count: duplicateBlocked,
    source_missing_count: sourceMissing,
    skipped_non_official_source: skippedNoOfficialSource,
    candidates_inserted: candidatesInserted,
    products: perProduct,
    counts_before: countsBefore,
    counts_after: countsAfter,
    protected_products_unchanged: true,
    protected_diff: protectedDiff,
    policy: {
      auto_verified_forbidden: true,
      products_update_forbidden: true,
      delete_forbidden: true,
      new_product_rows_forbidden_without_complete_verification: true,
    },
  };

  const applyResult = {
    phase: "staging_apply_done",
    project: "staging",
    dataSourceId,
    applied,
    verified_transition_count: 0,
    needs_review_count: needsReviewCount,
    new_products_created: 0,
    products_mutated_body: 0,
    products_total_before: countsBefore.products_total,
    products_total_after: countsAfter.products_total,
    counts_before: countsBefore,
    counts_after: countsAfter,
    idempotent: true,
  };

  fs.writeFileSync(
    path.join(OUT, "verification-report.json"),
    JSON.stringify(verificationReport, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    path.join(OUT, "staging-apply-result.json"),
    JSON.stringify(applyResult, null, 2),
    "utf8"
  );

  console.log(
    JSON.stringify({
      phase: "done",
      input: productsRaw.products.length,
      matched: matchedCount,
      newCandidates: newCandidateCount,
      candidatesInserted,
      verified: 0,
      needsReview: needsReviewCount,
      duplicateBlocked,
      sourceMissing,
      productsTotalBefore: countsBefore.products_total,
      productsTotalAfter: countsAfter.products_total,
      protectedUnchanged: true,
    })
  );
}

main().catch((e) => {
  console.error(
    JSON.stringify({ phase: "fatal", message: String(e?.message || e) })
  );
  process.exit(1);
});
