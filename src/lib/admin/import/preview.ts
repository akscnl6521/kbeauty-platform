import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AdminSession } from "@/lib/auth/admin";
import { assertAdminPermission } from "@/lib/auth/admin-permissions";
import { AdminConfigurationError } from "@/lib/auth/errors";
import { invalidInput, AdminWriteError } from "@/lib/admin/write-errors";
import { findImportDuplicate } from "@/lib/admin/import/duplicate-check";
import { extractProductFromHtml } from "@/lib/admin/import/extract-product";
import {
  fetchPublicHtmlPage,
  IMPORT_FETCH_LIMITS,
} from "@/lib/admin/import/fetch-page";
import {
  canonicalizeProductUrl,
  extractDomain,
  parseUrlListInput,
} from "@/lib/admin/import/normalize";
import { DISCOVERY_SOURCE_TYPES } from "@/lib/admin/discovery";
import type {
  ImportPreviewItem,
  ImportPreviewSummary,
  PreviewItemStatus,
} from "@/lib/admin/import/types";

export type { ImportPreviewItem, ImportPreviewSummary, PreviewItemStatus };

export type ImportPreviewResult = {
  items: ImportPreviewItem[];
  summary: ImportPreviewSummary;
};

const SOURCE_SET = new Set<string>(DISCOVERY_SOURCE_TYPES);

export type PreviewOverrides = Record<
  string,
  {
    productName?: string | null;
    brandName?: string | null;
    detectedCountry?: string | null;
    sourceType?: string | null;
    notes?: string | null;
  }
>;

function summarize(items: ImportPreviewItem[]): ImportPreviewResult["summary"] {
  const summary = {
    total: items.length,
    ready: 0,
    duplicate: 0,
    incomplete: 0,
    failed: 0,
  };
  for (const item of items) {
    summary[item.status] += 1;
  }
  return summary;
}

async function previewOneUrl(
  inputUrl: string,
  overrides?: PreviewOverrides[string]
): Promise<ImportPreviewItem> {
  const base: ImportPreviewItem = {
    inputUrl,
    canonicalUrl: null,
    productName: null,
    brandName: null,
    detectedCountry: null,
    sourceType: null,
    imageUrl: null,
    description: null,
    domain: extractDomain(inputUrl),
    price: null,
    currency: null,
    availability: null,
    status: "failed",
    duplicateCandidateId: null,
    duplicateProductId: null,
    warnings: [],
    errorCode: null,
    errorMessage: null,
  };

  const fetched = await fetchPublicHtmlPage(inputUrl);
  if (!fetched.ok) {
    return {
      ...base,
      status: "failed",
      errorCode: fetched.code,
      errorMessage: fetched.message,
    };
  }

  let extracted;
  try {
    extracted = extractProductFromHtml(fetched.html, fetched.finalUrl);
  } catch {
    return {
      ...base,
      canonicalUrl: canonicalizeProductUrl(fetched.finalUrl),
      status: "failed",
      errorCode: "PARSE_FAILED",
      errorMessage: "페이지 정보를 해석하지 못했습니다.",
    };
  }

  const productName =
    (overrides?.productName && overrides.productName.trim()) ||
    extracted.productName;
  const brandName =
    overrides?.brandName !== undefined
      ? overrides.brandName
      : extracted.brandName;
  const detectedCountry =
    (overrides?.detectedCountry && overrides.detectedCountry.trim()) ||
    extracted.detectedCountry;
  let sourceType =
    (overrides?.sourceType && overrides.sourceType.trim()) ||
    extracted.sourceType;
  if (sourceType && !SOURCE_SET.has(sourceType)) {
    sourceType = "other";
    extracted.warnings.push("허용되지 않은 source_type → other");
  }

  const canonicalUrl =
    extracted.canonicalUrl ?? canonicalizeProductUrl(fetched.finalUrl);

  const item: ImportPreviewItem = {
    ...base,
    canonicalUrl,
    productName,
    brandName,
    detectedCountry,
    sourceType,
    imageUrl: extracted.imageUrl,
    description: extracted.description,
    domain: extractDomain(canonicalUrl ?? fetched.finalUrl),
    price: extracted.price,
    currency: extracted.currency,
    availability: extracted.availability,
    warnings: extracted.warnings,
    status: "ready",
    errorCode: null,
    errorMessage: null,
  };

  if (!item.productName || !item.canonicalUrl) {
    return {
      ...item,
      status: "incomplete",
      errorCode: "PRODUCT_INFO_INCOMPLETE",
      errorMessage: "제품명 또는 URL을 확인할 수 없습니다.",
    };
  }

  try {
    const client = createSupabaseAdminClient();
    const dup = await findImportDuplicate(client, {
      canonicalUrl: item.canonicalUrl,
      productName: item.productName,
      brandName: item.brandName,
    });
    if (dup?.kind === "candidate") {
      return {
        ...item,
        status: "duplicate",
        duplicateCandidateId: dup.candidateId,
        errorCode: "DUPLICATE_CANDIDATE",
        errorMessage: "동일 후보가 이미 있습니다.",
        warnings: [
          ...item.warnings,
          dup.linkedProductId
            ? "기존 후보가 제품에 연결되어 있습니다"
            : "기존 discovery 후보와 중복",
        ],
      };
    }
    if (dup?.kind === "product") {
      return {
        ...item,
        status: "duplicate",
        duplicateProductId: dup.productId,
        errorCode: "DUPLICATE_PRODUCT",
        errorMessage: "동일 제품이 이미 있습니다.",
        warnings: [...item.warnings, "기존 products와 이름·브랜드 중복"],
      };
    }
  } catch (error) {
    if (error instanceof AdminConfigurationError) throw error;
    item.warnings.push("중복 검사 일부 실패(등록 시 재검사)");
  }

  return item;
}

/**
 * Preview URL import batch. Does not INSERT.
 */
export async function previewDiscoveryImport(
  session: AdminSession,
  input: { urls?: unknown; text?: unknown; overrides?: PreviewOverrides }
): Promise<ImportPreviewResult> {
  assertAdminPermission(session, "discovery.create");

  let urls: string[] = [];
  if (Array.isArray(input.urls)) {
    urls = input.urls
      .filter((u): u is string => typeof u === "string")
      .map((u) => u.trim())
      .filter(Boolean);
  } else if (typeof input.text === "string") {
    const parsed = parseUrlListInput(input.text, IMPORT_FETCH_LIMITS.maxBatchUrls);
    urls = parsed.urls;
    if (parsed.truncated) {
      throw new AdminWriteError(
        "BATCH_LIMIT_EXCEEDED",
        400,
        "URL은 최대 50개까지 분석할 수 있습니다."
      );
    }
  }

  // dedupe
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const url of urls) {
    const key = canonicalizeProductUrl(url) ?? url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(url);
  }

  if (unique.length === 0) {
    throw invalidInput("분석할 URL이 없습니다.");
  }
  if (unique.length > IMPORT_FETCH_LIMITS.maxBatchUrls) {
    throw new AdminWriteError(
      "BATCH_LIMIT_EXCEEDED",
      400,
      "URL은 최대 50개까지 분석할 수 있습니다."
    );
  }

  const overrides = input.overrides ?? {};
  const started = Date.now();
  const items: ImportPreviewItem[] = [];

  for (const url of unique) {
    if (Date.now() - started > IMPORT_FETCH_LIMITS.maxBatchTimeoutMs) {
      items.push({
        inputUrl: url,
        canonicalUrl: null,
        productName: null,
        brandName: null,
        detectedCountry: null,
        sourceType: null,
        imageUrl: null,
        description: null,
        domain: extractDomain(url),
        price: null,
        currency: null,
        availability: null,
        status: "failed",
        duplicateCandidateId: null,
        duplicateProductId: null,
        warnings: [],
        errorCode: "FETCH_TIMEOUT",
        errorMessage: "배치 전체 시간이 초과되어 중단되었습니다.",
      });
      continue;
    }

    const key = canonicalizeProductUrl(url) ?? url;
    items.push(await previewOneUrl(url, overrides[key] ?? overrides[url]));
  }

  return { items, summary: summarize(items) };
}
