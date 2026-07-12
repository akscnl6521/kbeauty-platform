"use client";

import { useEffect } from "react";
import type { CandidateProduct, RankedProduct } from "@/lib/recommend";
import {
  displayIngredientNames,
  logTopProductPurchaseLinkAudit,
  selectPurchaseLink,
} from "@/lib/recommend";

export type RecommendedProductCardProps = {
  /** 1부터 시작하는 순위 */
  rank: number;
  ranked: RankedProduct<CandidateProduct>;
  /** 표시용 로케일 (이름 선택) */
  locale?: "en" | "ja" | "ko";
  /** LocalStorage countryCode (구매 링크 선택) */
  countryCode?: string | null;
};

/**
 * 랭킹된 추천 제품 카드.
 * 유효한 구매 링크가 있을 때만 「구매처 보기」를 표시한다.
 */
export function RecommendedProductCard({
  rank,
  ranked,
  locale = "en",
  countryCode = null,
}: RecommendedProductCardProps) {
  const { product, score, matchedIngredients, excludedIngredients } = ranked;

  const displayName =
    locale === "ko" && product.name_ko
      ? product.name_ko
      : locale === "ja" && product.name_ja
        ? product.name_ja
        : product.name ?? product.name_ko ?? product.name_ja ?? "Untitled product";

  const brand = product.brand?.trim() || null;
  const price =
    typeof product.price_usd === "number" && Number.isFinite(product.price_usd)
      ? product.price_usd
      : null;
  const hasExcluded =
    Array.isArray(excludedIngredients) && excludedIngredients.length > 0;

  const matchedLabels = displayIngredientNames(matchedIngredients, locale);
  const excludedLabels = displayIngredientNames(excludedIngredients, locale);

  const purchase = selectPurchaseLink(product, countryCode);

  useEffect(() => {
    logTopProductPurchaseLinkAudit(product, countryCode, displayName);
  }, [product, countryCode, displayName]);

  return (
    <article
      className="flex flex-col gap-3 rounded-2xl border border-pink-100 bg-white p-4 shadow-sm sm:p-5"
      data-product-id={product.id}
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#C2185B] text-xs font-bold text-white"
          aria-label={`순위 ${rank}`}
        >
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-snug text-gray-900 sm:text-base">
            {displayName}
          </h3>
          {brand ? (
            <p className="mt-0.5 text-xs text-gray-500 sm:text-sm">{brand}</p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Score
          </p>
          <p className="text-sm font-bold text-[#C2185B] sm:text-base">
            {score.toFixed(2)}
          </p>
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          {locale === "ko"
            ? "매칭 성분"
            : locale === "ja"
              ? "マッチ成分"
              : "Matched ingredients"}
        </p>
        {matchedLabels.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {matchedLabels.map((ing) => (
              <span
                key={`match-${ing}`}
                className="inline-flex rounded-full bg-[#C2185B]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#C2185B] sm:text-xs"
              >
                {ing}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">
            {locale === "ko"
              ? "매칭된 성분 없음"
              : locale === "ja"
                ? "マッチ成分なし"
                : "No matched ingredients"}
          </p>
        )}
      </div>

      {hasExcluded && excludedLabels.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
            {locale === "ko"
              ? "주의 성분"
              : locale === "ja"
                ? "注意成分"
                : "Watch-outs"}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {excludedLabels.map((ing) => (
              <span
                key={`avoid-${ing}`}
                className="inline-flex rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 sm:text-xs"
              >
                {ing}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {price != null ? (
        <p className="text-xs text-gray-600 sm:text-sm">
          <span className="font-medium text-gray-800">USD</span>{" "}
          {price.toFixed(2)}
        </p>
      ) : null}

      {purchase ? (
        <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-gray-500 sm:text-xs">
            {purchase.marketplace}
          </p>
          <a
            href={purchase.url}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="inline-flex items-center justify-center rounded-full bg-[#C2185B] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#a3154f]"
          >
            {locale === "ko"
              ? "구매처 보기"
              : locale === "ja"
                ? "購入先を見る"
                : "View retailer"}
          </a>
        </div>
      ) : null}
    </article>
  );
}
