import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { tryInsertWriteAudit } from "@/lib/admin/audit-log";
import { assertSafePublicHttpsUrl } from "@/lib/admin/import/ssrf";
import { extractDomain } from "@/lib/admin/import/normalize";
import { loadPipelineOperationConfig } from "@/lib/pipeline/operation-config";
import {
  canAutoPersistOffer,
  classifyOfferSource,
  hostFromUrl,
} from "@/lib/pipeline/offers/offer-source-class";
import {
  canAutoSaveByIdentity,
  matchOfferToProduct,
} from "@/lib/pipeline/offers/offer-identity";
import {
  extractOffersFromHtml,
  summarizeExtractedOffer,
} from "@/lib/pipeline/offers/offer-extract";
import { parseShippingCountries } from "@/lib/pipeline/offers/offer-shipping";
import {
  evaluateOfferVerificationGate,
  freshnessExpiresAt,
} from "@/lib/pipeline/offers/offer-gate";
import { toSchemaRetailerCountry } from "@/lib/pipeline/offers/offer-price";

export type OfferPersistResult = {
  inserted: number;
  updated: number;
  verified: number;
  reviewQueued: number;
  skipped: number;
  reasons: string[];
};

function retailerNameFromHost(host: string | null): string {
  if (!host) return "Unknown retailer";
  const base = host.split(".")[0] ?? host;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Discover + persist offers for a product from official page HTML and optional legacy URLs.
 * Schema mapping only — never invents price/stock/shipping.
 */
export async function discoverAndPersistOffers(
  client: SupabaseClient,
  input: {
    productId: number;
    productName: string;
    brandName: string;
    productActive: boolean | null;
    pageHtml: string;
    pageUrl: string;
    officialHost?: string | null;
    legacyUrls?: string[];
    batchId: string;
    sizeLabel?: string | null;
  }
): Promise<OfferPersistResult> {
  const op = loadPipelineOperationConfig();
  const result: OfferPersistResult = {
    inserted: 0,
    updated: 0,
    verified: 0,
    reviewQueued: 0,
    skipped: 0,
    reasons: [],
  };

  if (!op.allowOfferCandidateInsert && !op.allowVerifiedOfferUpsert) {
    result.reasons.push("offer_writes_disabled");
    return result;
  }

  const signals = extractOffersFromHtml(input.pageHtml, input.pageUrl);
  for (const legacy of input.legacyUrls ?? []) {
    signals.push({
      purchaseUrl: legacy,
      priceText: null,
      currencyHint: null,
      availability: null,
      offerTitle: input.productName,
      offerBrand: input.brandName,
      method: "legacy_link",
      confidence: 0.3,
      reasons: ["legacy_link_requires_revalidation"],
    });
  }

  const maxOffers = op.maxOffersPerRun;
  let processed = 0;

  for (const signal of signals) {
    if (processed >= maxOffers) break;
    if (!signal.purchaseUrl) {
      result.skipped += 1;
      continue;
    }

    const safe = await assertSafePublicHttpsUrl(signal.purchaseUrl);
    if (!safe.ok) {
      result.skipped += 1;
      result.reasons.push("unsafe_url");
      continue;
    }
    const purchaseUrl = safe.normalizedHref;
    const host = hostFromUrl(purchaseUrl);
    const officialHost = (input.officialHost ?? "")
      .replace(/^www\./i, "")
      .toLowerCase();
    const sameHost =
      Boolean(officialHost) &&
      Boolean(host) &&
      (host === officialHost || host?.endsWith(`.${officialHost}`));

    const source = classifyOfferSource({
      purchaseUrl,
      sameAsOfficialBrandHost: sameHost,
      isOfficialClaim: sameHost,
      marketplaceOfficialStoreEvidence: false,
    });

    if (source.grade === "marketplace_seller") {
      result.skipped += 1;
      result.reasons.push("marketplace_seller_excluded");
      continue;
    }
    if (
      source.grade === "marketplace_official_store" &&
      !op.allowMarketplaceOfficialStore
    ) {
      result.skipped += 1;
      continue;
    }
    if (!canAutoPersistOffer(source.grade) && source.grade !== "retailer_unverified") {
      result.skipped += 1;
      continue;
    }
    // retailer_unverified: candidate only, never verified
    if (!canAutoPersistOffer(source.grade) && source.grade === "retailer_unverified") {
      // still allow unverified candidate if flag on
      if (!op.allowOfferCandidateInsert) {
        result.skipped += 1;
        continue;
      }
    }

    const summarized = summarizeExtractedOffer({
      ...signal,
      purchaseUrl,
      offerTitle: signal.offerTitle ?? input.productName,
      offerBrand: signal.offerBrand ?? input.brandName,
    });

    const identity = matchOfferToProduct({
      productName: input.productName,
      brandName: input.brandName,
      offerTitle: summarized.signal.offerTitle ?? input.productName,
      offerBrand: summarized.signal.offerBrand ?? input.brandName,
      sizeLabel: input.sizeLabel,
      offerSize: null,
    });

    if (identity.match === "mismatch" || !canAutoSaveByIdentity(identity.match)) {
      if (identity.match === "mismatch") {
        result.skipped += 1;
        result.reasons.push("identity_mismatch");
        continue;
      }
      if (identity.match === "ambiguous") {
        // queue only — no offer row with fake certainty
        if (op.allowOfferReviewQueue && op.allowQueueInsert) {
          await enqueueSaleReview(client, input.productId, input.batchId, "identity_ambiguous");
          result.reviewQueued += 1;
        }
        result.skipped += 1;
        continue;
      }
    }

    // Currency is a stronger real signal than TLD (many Korean brands sell
    // on .com domains with real KRW pricing) — prefer it when known.
    const retailerCountry = toSchemaRetailerCountry(
      summarized.price.currency === "KRW"
        ? "KR"
        : summarized.price.currency === "JPY"
          ? "JP"
          : host?.endsWith(".co.kr") || host?.endsWith(".kr")
            ? "KR"
            : host?.endsWith(".jp")
              ? "JP"
              : host?.endsWith(".com")
                ? "US"
                : "GLOBAL"
    );

    const shipping = parseShippingCountries({
      retailerCountry,
      explicitCountries: retailerCountry === "GLOBAL" ? [] : [retailerCountry],
    });

    const gate = evaluateOfferVerificationGate({
      grade: source.grade,
      identity: identity.match,
      identityConfidence: identity.confidence,
      purchaseUrl,
      price: summarized.price.price,
      currency: summarized.price.currency,
      stockStatus: summarized.stock.stockStatus,
      stockConfidence: summarized.stock.confidence,
      shipsToCountries: shipping.shipsToCountries,
      shippingConfidence: shipping.confidence,
      officialConfidenceThreshold: op.officialOfferConfidenceThreshold,
      productActive: input.productActive,
    });

    // Never verify without structured price+stock+shipping
    const wantVerified =
      gate.passVerified &&
      op.allowVerifiedOfferUpsert &&
      canAutoPersistOffer(source.grade) &&
      source.grade !== "marketplace_official_store";

    if (!wantVerified && !op.allowOfferCandidateInsert) {
      result.skipped += 1;
      continue;
    }

    if (gate.needsReview && op.allowOfferReviewQueue && op.allowQueueInsert) {
      await enqueueSaleReview(
        client,
        input.productId,
        input.batchId,
        gate.blockers.join(",") || "offer_needs_review"
      );
      result.reviewQueued += 1;
    }

    const row = {
      product_id: input.productId,
      retailer_name: retailerNameFromHost(host),
      retailer_country: retailerCountry,
      ships_to_countries: shipping.shipsToCountries,
      purchase_url: purchaseUrl,
      price: summarized.price.price,
      currency: summarized.price.currency,
      stock_status: summarized.stock.stockStatus,
      verification_status: wantVerified ? "verified" : "unverified",
      is_official: source.grade === "official_brand_store" || source.grade === "official_country_store",
      verified_at: wantVerified ? new Date().toISOString() : null,
      last_checked_at: new Date().toISOString(),
      active: true,
      source: `${signal.method}|${source.grade}|batch=${input.batchId}`,
    };

    // Idempotency: same product + purchase_url
    const { data: existing } = await client
      .from("product_offers")
      .select("id, verification_status, price, stock_status")
      .eq("product_id", input.productId)
      .eq("purchase_url", purchaseUrl)
      .limit(1);

    const existingRow = (existing ?? [])[0] as
      | {
          id: string;
          verification_status: string;
          price: number | null;
          stock_status: string;
        }
      | undefined;

    if (existingRow) {
      // Do not downgrade verified with weaker data
      if (
        existingRow.verification_status === "verified" &&
        !wantVerified
      ) {
        if (op.allowOfferFreshnessUpdate) {
          await client
            .from("product_offers")
            .update({ last_checked_at: new Date().toISOString() })
            .eq("id", existingRow.id);
        }
        result.skipped += 1;
        result.reasons.push("skip_downgrade_verified");
        processed += 1;
        continue;
      }

      const patch: Record<string, unknown> = {
        last_checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (op.allowOfferFreshnessUpdate) {
        if (summarized.price.price != null) patch.price = summarized.price.price;
        if (summarized.price.currency) patch.currency = summarized.price.currency;
        patch.stock_status = summarized.stock.stockStatus;
        patch.ships_to_countries = shipping.shipsToCountries;
      }
      if (wantVerified) {
        patch.verification_status = "verified";
        patch.verified_at = new Date().toISOString();
        patch.is_official = row.is_official;
      }

      const { error } = await client
        .from("product_offers")
        .update(patch)
        .eq("id", existingRow.id);
      if (!error) {
        result.updated += 1;
        if (wantVerified) result.verified += 1;
      }
      processed += 1;
      continue;
    }

    if (wantVerified || op.allowOfferCandidateInsert) {
      // Candidate path: require at least URL; verified path already gated
      if (!wantVerified && summarized.price.price == null) {
        // Allow unverified candidate without price? User said no fake price — storing null price is OK for unverified
      }
      const { error } = await client.from("product_offers").insert(row);
      if (!error) {
        result.inserted += 1;
        if (wantVerified) result.verified += 1;
        if (op.allowAuditInsert) {
          await tryInsertWriteAudit(client, {
            action: "discovery_candidate_created",
            productId: input.productId,
            actorRole: "admin",
            metadata: {
              via: "offer_discovery",
              domain: extractDomain(purchaseUrl),
              verification_status: row.verification_status,
              freshnessExpiresAt: freshnessExpiresAt(op.offerFreshnessHours),
            },
          });
        }
      } else {
        result.skipped += 1;
        result.reasons.push("insert_failed");
      }
    }
    processed += 1;
  }

  return result;
}

async function enqueueSaleReview(
  client: SupabaseClient,
  productId: number,
  batchId: string,
  reason: string
) {
  const { data: open } = await client
    .from("verification_queue")
    .select("id")
    .eq("entity_type", "product")
    .eq("entity_id", String(productId))
    .eq("review_type", "sale")
    .in("status", ["pending", "in_review"])
    .limit(1);
  if ((open ?? []).length) return;
  await client.from("verification_queue").insert({
    entity_type: "product",
    entity_id: String(productId),
    review_type: "sale",
    priority: 90,
    status: "pending",
    reason: `offer:${reason}|batch=${batchId}`.slice(0, 500),
    assigned_to: null,
    reviewer_notes: null,
  });
}
