/**
 * 카탈로그 중복 점검 (관리자 입력 단계).
 * 추천 점수·필터 로직과 분리한다.
 */

import type { KoreanProductInput, KoreanProductOfferInput } from "./catalogTypes";

export type DuplicateIdIssue = {
  kind: "productId" | "offerId";
  id: string;
  count: number;
  indexes: number[];
};

export type DuplicateProductGroup = {
  /** normalize 된 브랜드|제품명 키 */
  key: string;
  canonicalBrandName: string;
  productNameKo: string;
  productNameEn: string;
  productIds: string[];
  indexes: number[];
};

export type DuplicateScanResult = {
  duplicateProductIds: DuplicateIdIssue[];
  duplicateOfferIds: DuplicateIdIssue[];
  duplicateBrandProductNames: DuplicateProductGroup[];
  hasDuplicates: boolean;
};

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeNameKey(value: string): string {
  return collapse(value)
    .toLowerCase()
    .replace(/[,.'’+]/g, "");
}

function duplicateIds(
  kind: "productId" | "offerId",
  ids: Array<string | null | undefined>
): DuplicateIdIssue[] {
  const map = new Map<string, number[]>();
  ids.forEach((raw, index) => {
    const id = typeof raw === "string" ? collapse(raw) : "";
    if (!id) return;
    const list = map.get(id) ?? [];
    list.push(index);
    map.set(id, list);
  });

  const out: DuplicateIdIssue[] = [];
  for (const [id, indexes] of map) {
    if (indexes.length < 2) continue;
    out.push({ kind, id, count: indexes.length, indexes });
  }
  return out;
}

/**
 * 동일 canonicalBrandName + 제품명(KO 또는 EN) 중복 그룹.
 * 브랜드·제품명을 분리해 비교한다 (번역 정규화 없음).
 */
export function findDuplicateBrandProductNames(
  products: readonly KoreanProductInput[]
): DuplicateProductGroup[] {
  const byKey = new Map<
    string,
    {
      canonicalBrandName: string;
      productNameKo: string;
      productNameEn: string;
      productIds: string[];
      indexes: number[];
    }
  >();

  products.forEach((p, index) => {
    const brand = normalizeNameKey(p.canonicalBrandName ?? "");
    const ko = normalizeNameKey(p.productNameKo ?? "");
    const en = normalizeNameKey(p.productNameEn ?? "");
    if (!brand || (!ko && !en)) return;

    const nameKey = ko || en;
    const key = `${brand}|${nameKey}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.productIds.push(p.productId);
      existing.indexes.push(index);
      return;
    }
    byKey.set(key, {
      canonicalBrandName: collapse(p.canonicalBrandName),
      productNameKo: collapse(p.productNameKo ?? ""),
      productNameEn: collapse(p.productNameEn ?? ""),
      productIds: [p.productId],
      indexes: [index],
    });
  });

  const groups: DuplicateProductGroup[] = [];
  for (const [key, g] of byKey) {
    if (g.indexes.length < 2) continue;
    groups.push({ key, ...g });
  }
  return groups;
}

/** productId / offerId / 브랜드·제품명 중복 일괄 스캔 */
export function findDuplicateProducts(
  products: readonly KoreanProductInput[],
  offers: readonly KoreanProductOfferInput[] = []
): DuplicateScanResult {
  const duplicateProductIds = duplicateIds(
    "productId",
    products.map((p) => p.productId)
  );
  const duplicateOfferIds = duplicateIds(
    "offerId",
    offers.map((o) => o.offerId)
  );
  const duplicateBrandProductNames = findDuplicateBrandProductNames(products);

  return {
    duplicateProductIds,
    duplicateOfferIds,
    duplicateBrandProductNames,
    hasDuplicates:
      duplicateProductIds.length > 0 ||
      duplicateOfferIds.length > 0 ||
      duplicateBrandProductNames.length > 0,
  };
}
