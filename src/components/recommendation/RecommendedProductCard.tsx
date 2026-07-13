"use client";

import { useEffect } from "react";
import type { CandidateProduct, RankedProduct } from "@/lib/recommend";
import {
  displayIngredientNames,
  formatOfferPrice,
  formatVerifiedAtForDisplay,
  logTopProductPurchaseLinkAudit,
  selectPurchaseLink,
} from "@/lib/recommend";
import {
  displayBrandName,
  displayProductTitle,
} from "@/lib/brand/displayBrandName";

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
 * 브랜드명은 번역하지 않고 canonical(또는 공식 검증 KO)만 표시한다.
 */
export function RecommendedProductCard({
  rank,
  ranked,
  locale = "ko",
  countryCode = null,
}: RecommendedProductCardProps) {
  const { product, score, matchedIngredients, excludedIngredients } = ranked;

  const displayName = displayProductTitle({
    name: product.name,
    nameKo: product.name_ko,
    nameJa: product.name_ja,
    brand: product.brand,
    locale,
  });

  const brand = displayBrandName(product.brand, locale);
  const hasExcluded =
    Array.isArray(excludedIngredients) && excludedIngredients.length > 0;

  const matchedLabels = displayIngredientNames(matchedIngredients, locale);
  const excludedLabels = displayIngredientNames(excludedIngredients, locale);

  const purchase = selectPurchaseLink(product, countryCode);

  useEffect(() => {
    logTopProductPurchaseLinkAudit(product, countryCode, displayName);
  }, [product, countryCode, displayName]);

  const lastCheckedRaw =
    purchase?.verifiedAt ??
    product.offers?.find((o) => o.lastCheckedAt)?.lastCheckedAt ??
    product.offers?.[0]?.verifiedAt ??
    null;
  const lastCheckedLabel =
    formatVerifiedAtForDisplay(lastCheckedRaw, locale) ??
    (lastCheckedRaw
      ? locale === "ko"
        ? "확인일 정보 없음"
        : locale === "ja"
          ? "確認日情報なし"
          : "Verification date unavailable"
      : null);

  const noPurchaseMessage =
    locale === "ko"
      ? `현재 확인된 판매처 정보가 없습니다.${
          lastCheckedLabel
            ? ` 마지막 확인: ${lastCheckedLabel}`
            : " 마지막 확인: 미확인"
        }`
      : locale === "ja"
        ? `確認済みの販売先情報がありません。${
            lastCheckedLabel
              ? `最終確認: ${lastCheckedLabel}`
              : "最終確認: 未確認"
          }`
        : `No verified retailer information available.${
            lastCheckedLabel
              ? ` Last checked: ${lastCheckedLabel}`
              : " Last checked: unknown"
          }`;

  const offerPriceLabel = purchase
    ? formatOfferPrice(purchase.price, purchase.currency, locale)
    : null;

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
            {locale === "ko" ? "점수" : locale === "ja" ? "スコア" : "Score"}
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

      {purchase ? (
        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-0.5">
            <p className="text-[11px] text-gray-500 sm:text-xs">
              {purchase.retailerName}
              {purchase.verificationStatus === "verified"
                ? locale === "ko"
                  ? " · 검증됨"
                  : locale === "ja"
                    ? " · 検証済"
                    : " · Verified"
                : ""}
            </p>
            <p className="text-sm font-semibold text-gray-900">
              {offerPriceLabel ??
                (locale === "ko"
                  ? "가격 미확인"
                  : locale === "ja"
                    ? "価格未確認"
                    : "Price unverified")}
            </p>
            {purchase.verifiedAt ? (
              <p className="text-[10px] text-gray-400">
                {formatVerifiedAtForDisplay(purchase.verifiedAt, locale) ??
                  (locale === "ko"
                    ? "확인일 정보 없음"
                    : locale === "ja"
                      ? "確認日情報なし"
                      : "Verification date unavailable")}
              </p>
            ) : (
              <p className="text-[10px] text-gray-400">
                {locale === "ko"
                  ? "확인일 정보 없음"
                  : locale === "ja"
                    ? "確認日情報なし"
                    : "Verification date unavailable"}
              </p>
            )}
          </div>
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
      ) : (
        <p className="mt-1 text-[11px] leading-relaxed text-gray-500 sm:text-xs">
          {noPurchaseMessage}
        </p>
      )}
    </article>
  );
}
