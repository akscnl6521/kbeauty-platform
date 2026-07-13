import "server-only";

import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { extractDomain } from "@/lib/admin/import/normalize";
import { getPipelinePersistence } from "@/lib/pipeline/persistence";
import { seedBrandsFromCatalog } from "@/lib/pipeline/brand-discovery";
import { decideProductDedupe } from "@/lib/pipeline/dedupe";
import { pipelineLog } from "@/lib/pipeline/logger";
import { extractCatalogProductFromUrl } from "@/lib/pipeline/product-extraction";
import { applyJobFailure } from "@/lib/pipeline/retry";
import {
  classifySkinMatch,
  computeQualityScore,
  scoreToneUndertone,
} from "@/lib/pipeline/scoring";
import { discoverOfficialSiteAndProducts } from "@/lib/pipeline/site-crawler";
import { parseIngredientList } from "@/lib/pipeline/ingredient-normalize";
import { linkIngredientSafetyHints } from "@/lib/pipeline/evidence-link";
import { emptyProgress, recomputeProgress } from "@/lib/pipeline/progress";
import { commitDiscoveryCandidateGated } from "@/lib/pipeline/candidate-commit";
import type {
  PipelineBatch,
  PipelineJob,
  PipelineMode,
} from "@/lib/pipeline/types";
import type { OfficialSiteResolution } from "@/lib/pipeline/official-site-resolver";

function store(mode?: PipelineMode) {
  return getPipelinePersistence({
    requireSupabase: mode === "commit",
  });
}

export async function createPipelineBatch(input: {
  mode?: PipelineMode;
  brandLimit?: number;
  productLimitPerBrand?: number;
  triggerType?: PipelineBatch["triggerType"];
}): Promise<PipelineBatch> {
  const mode: PipelineMode = input.mode === "commit" ? "commit" : "dry_run";
  const brandLimit = Math.min(50, Math.max(1, input.brandLimit ?? 10));
  const productLimitPerBrand = Math.min(
    500,
    Math.max(1, input.productLimitPerBrand ?? 20)
  );

  const persistence = store(mode);
  const batch = await persistence.createBatch({
    mode,
    triggerType: input.triggerType ?? "manual",
    brandLimit,
    productLimitPerBrand,
  });

  const brandsRaw = await seedBrandsFromCatalog(brandLimit);
  const { enrichBrandSeedsWithOfficialSites } = await import(
    "@/lib/pipeline/brand-discovery"
  );
  const brands = await enrichBrandSeedsWithOfficialSites(brandsRaw);
  const jobs: PipelineJob[] = brands.map((brand) => ({
    jobId: randomUUID(),
    batchId: batch.batchId,
    entityType: "brand" as const,
    entityId: brand.brandKey,
    sourceKey: `brand:${brand.brandKey}:brand_seed`,
    brandName: brand.canonicalName,
    entityLabel: brand.canonicalName,
    stage: "brand_seed" as const,
    status: "queued" as const,
    attempts: 0,
    maxAttempts: 3,
    nextRetryAt: null,
    claimedBy: null,
    claimHeartbeatAt: null,
    startedAt: null,
    completedAt: null,
    failureCode: null,
    safeFailureMessage: null,
    checkpoint: { brand },
    warnings: [],
    resultSummary: null,
  }));

  await persistence.createJobs(jobs);
  const withProgress: PipelineBatch = {
    ...batch,
    progress: { ...emptyProgress(), totalItems: jobs.length },
  };
  await persistence.updateBatch(withProgress);

  pipelineLog("info", "batch created", {
    batchId: batch.batchId,
    mode,
    backend: persistence.backend,
    brands: brands.length,
  });

  return withProgress;
}

async function maybeCommitCandidate(input: {
  mode: PipelineMode;
  product: import("@/lib/pipeline/types").ExtractedCatalogProduct;
  brandName: string;
  batchId: string;
  siteResolution: OfficialSiteResolution | null;
  dedupe: import("@/lib/pipeline/types").DedupeDecision;
  quality: import("@/lib/pipeline/types").QualityScore;
  officialConfidence: number;
}): Promise<{
  candidateId: string | null;
  queueId: string | null;
  skippedReason: string | null;
  committed: boolean;
}> {
  if (input.mode !== "commit") {
    return {
      candidateId: null,
      queueId: null,
      skippedReason: "dry_run",
      committed: false,
    };
  }

  const client = createSupabaseAdminClient();
  return commitDiscoveryCandidateGated(client, {
    product: input.product,
    brandName: input.brandName,
    batchId: input.batchId,
    site: input.siteResolution,
    dedupe: input.dedupe,
    quality: input.quality,
    officialConfidence: input.officialConfidence,
  });
}

/**
 * Process up to `limit` runnable jobs for a batch (DB claim + persistence).
 */
export async function tickPipelineBatch(
  batchId: string,
  options?: { limit?: number; workerId?: string }
): Promise<{ batch: PipelineBatch; processed: number }> {
  const workerId = options?.workerId ?? `worker-${process.pid}`;
  const limit = options?.limit ?? 5;
  const persistence = store();

  const locked = await persistence.acquireWorkerLock(batchId, workerId);
  if (!locked) {
    const batch = await persistence.getBatch(batchId);
    if (!batch) throw new Error("batch not found");
    return { batch, processed: 0 };
  }

  try {
    let batch = await persistence.getBatch(batchId);
    if (!batch) throw new Error("batch not found");
    if (batch.status === "paused" || batch.status === "cancelled") {
      return { batch, processed: 0 };
    }

    const now = new Date().toISOString();
    if (batch.status === "queued") {
      batch = {
        ...batch,
        status: "running",
        startedAt: batch.startedAt ?? now,
        updatedAt: now,
        lockOwner: workerId,
        lockHeartbeatAt: now,
      };
      await persistence.updateBatch(batch);
    } else {
      await persistence.heartbeat(batchId, workerId);
    }

    const claimed = await persistence.claimNextJobs(batchId, workerId, limit);
    let processed = 0;

    for (const job of claimed) {
      processed += 1;
      let current: PipelineJob = { ...job };

      try {
        if (current.stage === "brand_seed") {
          const brand = current.checkpoint.brand as {
            brandKey: string;
            canonicalName: string;
            officialWebsite: string | null;
            confidence: number;
            productCount: number;
            source: string;
            countryCode: string | null;
          };

          const site = await discoverOfficialSiteAndProducts(
            {
              brandKey: brand.brandKey,
              canonicalName: brand.canonicalName,
              source: brand.source as "products",
              productCount: brand.productCount,
              officialWebsite: brand.officialWebsite,
              countryCode: brand.countryCode,
              confidence: brand.confidence,
            },
            { maxProductUrls: batch.productLimitPerBrand }
          );

          current.checkpoint = { ...current.checkpoint, site };
          current.resultSummary = {
            productUrlCount: site.productUrls.length,
            verified: site.verified,
            blocked: site.blocked,
            connector: site.connector,
          };

          await persistence.saveBrandResolution({
            brandKey: brand.brandKey,
            canonicalName: brand.canonicalName,
            candidateUrl: site.candidateUrl,
            verifiedUrl: site.verified ? site.candidateUrl : null,
            officialDomain: site.candidateUrl
              ? extractDomain(site.candidateUrl)
              : null,
            verificationStatus: site.blocked
              ? "blocked"
              : site.resolution?.classification === "verified_official"
                ? "verified"
                : site.needsReview
                  ? "needs_review"
                  : site.verified
                    ? "verified"
                    : "unverified",
            connector: site.connector,
            confidence: site.confidence,
            crawlStatus: site.blocked
              ? "blocked"
              : site.productUrls.length
                ? "urls_found"
                : "no_urls",
            robotsStatus: site.sitemapUrls.length ? "sitemap_found" : null,
            sitemapStatus: site.sitemapUrls.length
              ? `${site.sitemapUrls.length}_sitemaps`
              : null,
            lastErrorCode: site.blocked ? "HTTP_403" : null,
            safeErrorMessage: site.blocked
              ? site.reasons[0] ?? null
              : site.productUrls.length === 0
                ? "제품 URL 미수집"
                : null,
            sourceMetadata: {
              reasons: site.reasons,
              classification: site.resolution?.classification ?? null,
              productUrlCount: site.productUrls.length,
            },
          });

          current.checkpoint = {
            ...current.checkpoint,
            site,
            resolution: site.resolution ?? null,
          };

          if (site.blocked) {
            current = applyJobFailure(current, "HTTP_403", "사이트 차단/챌린지");
          } else if (site.needsReview && site.productUrls.length === 0) {
            current = {
              ...current,
              status: "needs_review",
              stage: "official_site_candidate",
              completedAt: new Date().toISOString(),
              warnings: site.reasons,
              failureCode: "NEEDS_REVIEW",
              safeFailureMessage: site.reasons[0] ?? "공식 사이트 검토 필요",
              claimedBy: null,
              claimHeartbeatAt: null,
            };
          } else {
            const urls = site.productUrls.slice(0, batch.productLimitPerBrand);
            const children: PipelineJob[] = urls.map((url) => ({
              jobId: randomUUID(),
              batchId,
              entityType: "product_url" as const,
              entityId: url,
              sourceKey: `product_url:${url}:product_urls_collected`,
              brandName: brand.canonicalName,
              entityLabel: `${brand.canonicalName} · ${url.slice(0, 60)}`,
              stage: "product_urls_collected" as const,
              status: "queued" as const,
              attempts: 0,
              maxAttempts: 3,
              nextRetryAt: null,
              claimedBy: null,
              claimHeartbeatAt: null,
              startedAt: null,
              completedAt: null,
              failureCode: null,
              safeFailureMessage: null,
              checkpoint: {
                brand,
                url,
                site,
                resolution: site.resolution ?? null,
              },
              warnings: [],
              resultSummary: null,
            }));
            await persistence.createJobs(children);

            current = {
              ...current,
              status: site.needsReview
                ? "completed_with_warnings"
                : "completed",
              stage: "sitemap_discovered",
              completedAt: new Date().toISOString(),
              warnings: site.reasons,
              claimedBy: null,
              claimHeartbeatAt: null,
              resultSummary: {
                ...current.resultSummary,
                productUrlCount: urls.length,
                classification: site.resolution?.classification ?? null,
              },
            };
          }
        } else if (current.stage === "product_urls_collected") {
          const url = String(current.checkpoint.url ?? current.entityId);
          const brandName = String(
            (current.checkpoint.brand as { canonicalName?: string })
              ?.canonicalName ?? "Unknown"
          );
          const extracted = await extractCatalogProductFromUrl(url, {
            fallbackBrand: brandName !== "Unknown" ? brandName : null,
          });
          if (!extracted.ok) {
            current = applyJobFailure(
              current,
              extracted.code,
              extracted.message
            );
          } else {
            const client = createSupabaseAdminClient();
            const dedupe = await decideProductDedupe(client, extracted.product);
            const ingredients = parseIngredientList(
              extracted.product.fullIngredientsText
            );
            const safetyHints = linkIngredientSafetyHints(
              ingredients.normalized.map((n) => n.normalizedName)
            );
            const skin = classifySkinMatch(extracted.product);
            const tone = scoreToneUndertone(extracted.product);
            const siteMeta = current.checkpoint.site as
              | { verified?: boolean; confidence?: number }
              | undefined;
            const resolution = (current.checkpoint.resolution ??
              null) as OfficialSiteResolution | null;
            const officialConfidence =
              resolution?.confidence ?? siteMeta?.confidence ?? 0;

            const quality = computeQualityScore({
              product: extracted.product,
              hasIngredients: ingredients.normalized.length > 0,
              hasOfficialSource: Boolean(
                siteMeta?.verified || resolution?.allowCrawl
              ),
              dedupeOk: dedupe.action !== "needs_review",
              offerCount: 0,
            });

            const entityKey = `url:${extracted.product.canonicalUrl}`;

            await persistence.saveFieldProvenance({
              entityType: "job",
              entityId: current.jobId,
              fieldName: "productName",
              valueSummary: extracted.product.productName,
              sourceUrl: extracted.product.canonicalUrl,
              sourceDomain: extractDomain(extracted.product.canonicalUrl),
              extractionMethod: extracted.product.extractionMethod,
              confidence: extracted.product.confidence,
            });

            await persistence.saveQualityScore({
              entityKey,
              quality,
            });
            await persistence.saveSkinMatchScore({
              entityKey,
              skin,
              tone,
            });

            let commitMeta: Record<string, unknown> = { mode: batch.mode };
            if (batch.mode === "commit") {
              const saved = await maybeCommitCandidate({
                mode: batch.mode,
                product: extracted.product,
                brandName: extracted.product.brandName || brandName,
                batchId: batch.batchId,
                siteResolution: resolution,
                dedupe,
                quality,
                officialConfidence,
              });
              commitMeta = { ...commitMeta, ...saved };

              if (saved.committed || dedupe.action === "link_existing") {
                const { enrichCatalogAfterCandidate } = await import(
                  "@/lib/pipeline/catalog-enrich"
                );
                const enrich = await enrichCatalogAfterCandidate(client, {
                  product: extracted.product,
                  brandName: extracted.product.brandName || brandName,
                  batchId: batch.batchId,
                  candidateId: saved.candidateId,
                  site: resolution
                    ? {
                        classification: resolution.classification,
                        confidence: resolution.confidence,
                        allowCrawl: resolution.allowCrawl,
                        selectedUrl: resolution.selectedUrl,
                      }
                    : siteMeta
                      ? {
                          classification: siteMeta.verified
                            ? "verified_official"
                            : undefined,
                          confidence: siteMeta.confidence,
                          allowCrawl: Boolean(siteMeta.verified),
                        }
                      : null,
                  dedupe,
                  quality,
                  officialConfidence,
                  parsedIngredients: ingredients,
                  skin,
                  tone,
                });
                commitMeta = { ...commitMeta, enrich };
              }
            }

            current.checkpoint = {
              ...current.checkpoint,
              product: extracted.product,
              dedupe,
              ingredients,
              safetyHints,
              skin,
              tone,
              quality,
              commitMeta,
            };
            current.resultSummary = {
              productName: extracted.product.productName,
              dedupe: dedupe.action,
              quality: quality.grade,
              publishEligible: false,
              skinTypes: skin.skinTypes,
              toneRelevance: tone.toneRelevance,
              committed: Boolean(
                (commitMeta as { committed?: boolean }).committed
              ),
              candidateId:
                (commitMeta as { candidateId?: string | null }).candidateId ??
                null,
            };

            const safetyReview = safetyHints.some((h) => h.needsReview);
            const commitSkipped =
              batch.mode === "commit" &&
              !(commitMeta as { committed?: boolean }).committed &&
              dedupe.action === "create_candidate";

            if (
              dedupe.action === "needs_review" ||
              skin.marketingOnly ||
              safetyReview ||
              commitSkipped
            ) {
              current = {
                ...current,
                status: "needs_review",
                stage: "product_deduplicated",
                completedAt: new Date().toISOString(),
                warnings: [
                  ...dedupe.reasons,
                  ...skin.reasons,
                  ...((commitMeta as { skippedReason?: string }).skippedReason
                    ? [String((commitMeta as { skippedReason?: string }).skippedReason)]
                    : []),
                ],
                claimedBy: null,
                claimHeartbeatAt: null,
              };
            } else if (dedupe.action === "link_existing") {
              current = {
                ...current,
                status: "completed",
                stage: "product_deduplicated",
                completedAt: new Date().toISOString(),
                warnings: dedupe.reasons,
                claimedBy: null,
                claimHeartbeatAt: null,
              };
            } else {
              current = {
                ...current,
                status: "completed",
                stage: "skin_match_scored",
                completedAt: new Date().toISOString(),
                claimedBy: null,
                claimHeartbeatAt: null,
              };
            }
          }
        } else {
          current = {
            ...current,
            status: "completed",
            completedAt: new Date().toISOString(),
            warnings: [...current.warnings, "unsupported stage skipped"],
            claimedBy: null,
            claimHeartbeatAt: null,
          };
        }
      } catch {
        current = applyJobFailure(
          current,
          "INTERNAL_ERROR",
          "작업 처리 중 오류가 발생했습니다."
        );
      }

      await persistence.updateJob(current);
      await persistence.heartbeat(batchId, workerId);
    }

    const allJobs = await persistence.listJobs(batchId);
    const progress = recomputeProgress(allJobs);
    const pending = allJobs.some((j) =>
      ["queued", "running", "retry_wait"].includes(j.status)
    );

    batch = {
      ...batch,
      progress,
      updatedAt: new Date().toISOString(),
      status: pending
        ? "running"
        : progress.failedItems > 0 || progress.reviewItems > 0
          ? "completed_with_warnings"
          : "completed",
      completedAt: pending ? null : new Date().toISOString(),
      lockOwner: workerId,
      lockHeartbeatAt: new Date().toISOString(),
    };
    await persistence.updateBatch(batch);
    return { batch, processed };
  } finally {
    await persistence.releaseWorkerLock(batchId, workerId);
  }
}

export async function setPipelineBatchStatus(
  batchId: string,
  status: "paused" | "cancelled" | "queued"
): Promise<PipelineBatch | null> {
  const persistence = store();
  const batch = await persistence.getBatch(batchId);
  if (!batch) return null;
  const next: PipelineBatch = {
    ...batch,
    status: status === "queued" ? "queued" : status,
    pausedAt: status === "paused" ? new Date().toISOString() : batch.pausedAt,
    updatedAt: new Date().toISOString(),
    completedAt:
      status === "cancelled" ? new Date().toISOString() : batch.completedAt,
    lockOwner: status === "paused" || status === "cancelled" ? null : batch.lockOwner,
  };
  await persistence.updateBatch(next);
  return next;
}

export async function retryFailedJobs(batchId: string): Promise<number> {
  const persistence = store();
  const jobs = await persistence.listJobs(batchId);
  let count = 0;
  for (const job of jobs) {
    if (job.status !== "failed" && job.status !== "retry_wait") continue;
    await persistence.updateJob({
      ...job,
      status: "queued",
      nextRetryAt: null,
      failureCode: null,
      safeFailureMessage: null,
      completedAt: null,
      claimedBy: null,
      claimHeartbeatAt: null,
    });
    count += 1;
  }
  const batch = await persistence.getBatch(batchId);
  if (batch) {
    await persistence.updateBatch({
      ...batch,
      status: "queued",
      triggerType: "retry",
      updatedAt: new Date().toISOString(),
      completedAt: null,
      pausedAt: null,
    });
  }
  return count;
}
