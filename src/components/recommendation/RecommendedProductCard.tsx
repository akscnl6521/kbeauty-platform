"use client";

import { useEffect } from "react";
import type { CandidateProduct, RankedProduct } from "@/lib/recommend";
import {
  displayIngredientNames,
  formatOfferPrice,
  formatVerifiedAtForDisplay,
  getRetailerDisplayName,
  logTopProductPurchaseLinkAudit,
  selectPurchaseLink,
} from "@/lib/recommend";
import {
  displayBrandName,
  displayProductTitle,
  isKoreanBeautyBrand,
} from "@/lib/brand/displayBrandName";
import { buildMatchReason, buildEvidenceCitationItems } from "@/lib/recommend/buildMatchReason";
import type { Recommendation } from "@/lib/recommend";
import {
  displayProductFormLabel,
  getProductTrustStatus,
  productTrustStatusLabel,
} from "@/lib/recommend/displayProductMeta";
import { resolveDisplaySizeLabel } from "@/lib/catalog/verifiedDisplayOverrides";
import { isOfferEligibleForCoreRecommendation } from "@/lib/recommend/productOffer";
import {
  normalizeShippingCountry,
  type ShippingCountry,
} from "@/lib/recommend/selectPurchaseLink";

export type RecommendedProductCardProps = {
  rank: number;
  ranked: RankedProduct<CandidateProduct>;
  locale?: "en" | "ja" | "ko";
  countryCode?: string | null;
  hidePurchaseCta?: boolean;
  recommendation?: Recommendation | null;
  softCareMode?: boolean;
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
  hidePurchaseCta = false,
  recommendation = null,
  softCareMode = false,
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
  const showKoreanBadge = isKoreanBeautyBrand(product.brand);
  const matchReason =
    recommendation != null
      ? buildMatchReason({
          recommendation,
          matchedIngredients,
          product,
          locale,
        })
      : null;
  const evidenceCitations =
    recommendation != null
      ? buildEvidenceCitationItems({
          recommendation,
          matchedIngredients,
        })
      : [];
  const sizeLabel = resolveDisplaySizeLabel({
    productId: product.id,
    name: product.name,
    nameKo: product.name_ko,
  });
  const formLabel = displayProductFormLabel(
    (product as { category?: string | null }).category ?? null,
    locale
  );
  const shipping = normalizeShippingCountry(countryCode) as ShippingCountry;
  const hasVerifiedOffer = Boolean(
    product.offers?.some((o) => isOfferEligibleForCoreRecommendation(o, shipping))
  );
  const trustStatus = getProductTrustStatus({
    productVerifiedAt: (product as { verified_at?: string | null }).verified_at,
    hasVerifiedOffer,
    hasAnyOffer: Boolean(product.offers?.length),
  });
  const trustLabel =
    trustStatus === "manual_review"
      ? null
      : productTrustStatusLabel(trustStatus, locale);
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
      ? `현재 확인된 판매처가 없습니다.${
          lastCheckedLabel ? ` 마지막 확인: ${lastCheckedLabel}` : ""
        }`
      : locale === "ja"
        ? `確認済みの販売先がありません。${
            lastCheckedLabel ? `最終確認: ${lastCheckedLabel}` : ""
          }`
        : `No verified retailer available.${
            lastCheckedLabel ? ` Last checked: ${lastCheckedLabel}` : ""
          }`;

  const offerPriceLabel = purchase
    ? formatOfferPrice(purchase.price, purchase.currency, locale)
    : null;
  const hasDisplayablePrice =
    Boolean(offerPriceLabel) &&
    offerPriceLabel !== "가격 정보 없음" &&
    offerPriceLabel !== "価格情報なし" &&
    offerPriceLabel !== "Price unavailable";

  const retailerLabel = purchase
    ? getRetailerDisplayName({
        retailerName: purchase.retailerName,
        retailerCountry: purchase.retailerCountry ?? null,
        isOfficial: purchase.isOfficial,
        locale,
      })
    : "";

  const verifiedImage =
    product.image_verified === true && product.image_url?.trim()
      ? product.image_url.trim()
      : null;
  const imageAlt = `${[brand, displayName].filter(Boolean).join(" ")} 제품 이미지`.trim();
  const imageFallback =
    locale === "ko"
      ? "검증된 제품 이미지 없음"
      : locale === "ja"
        ? "検証済み製品画像なし"
        : "No verified product image";

  return (
    <article
      className="grid gap-4 border-b border-[var(--border-soft)] py-6 first:pt-0 last:border-b-0 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:gap-6 sm:py-8"
      data-product-id={product.id}
    >
      <div className="overflow-hidden rounded-[var(--radius-panel)] bg-[var(--surface-muted)]">
        <div className="relative aspect-square w-full sm:aspect-[4/3]">
          {verifiedImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote official URLs; domain allowlist follows staging media policy
            <img
              src={verifiedImage}
              alt={imageAlt}
              className="h-full w-full object-contain p-3"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                const fb = e.currentTarget.nextElementSibling;
                if (fb instanceof HTMLElement) fb.hidden = false;
              }}
            />
          ) : null}
          <div
            className="kb-media-fallback absolute inset-0"
            hidden={Boolean(verifiedImage)}
            role="img"
            aria-label={imageFallback}
          >
            {imageFallback}
          </div>
        </div>
      </div>

      <div className="min-w-0 space-y-4">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-[11px] font-bold text-white"
            aria-label={`순위 ${rank}`}
          >
            {rank}
          </span>
          <div className="min-w-0 flex-1">
            {brand ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-subtle)] sm:text-xs">
                  {brand}
                </p>
                {showKoreanBadge ? (
                  <span className="text-[10px] font-medium text-[var(--brand)]">
                    {locale === "ko" ? "한국 브랜드" : "K-Beauty"}
                  </span>
                ) : null}
                {softCareMode ? (
                  <span className="text-[10px] font-medium text-[var(--text-subtle)]">
                    {locale === "ko" ? "보조 관리 참고" : "Supportive care"}
                  </span>
                ) : null}
              </div>
            ) : null}
            <h3 className="mt-1 break-words text-base font-semibold leading-snug text-[#2a1c14] sm:text-lg">
              {displayName}
            </h3>
            {(sizeLabel || formLabel) && (
              <p className="mt-1 text-xs text-[var(--text-subtle)]">
                {[sizeLabel, formLabel].filter(Boolean).join(" · ")}
              </p>
            )}
            {trustLabel ? (
              <p className="mt-1 text-[11px] text-[var(--text-subtle)]">{trustLabel}</p>
            ) : null}
          </div>
          <p className="shrink-0 text-right text-[10px] text-[var(--text-subtle)]">
            <span className="block tracking-wide">
              {locale === "ko" ? "참고 점수" : locale === "ja" ? "参考スコア" : "Ref. score"}
            </span>
            <span className="mt-0.5 block tabular-nums text-xs font-medium text-[var(--text-muted)]">
              {score.toFixed(2)}
            </span>
          </p>
        </div>

        {matchReason ? (
          <div>
            <p className="mb-1 text-[11px] font-semibold tracking-wide text-[var(--accent-warm)]">
              {locale === "ko"
                ? "추천 이유"
                : locale === "ja"
                  ? "おすすめ理由"
                  : "Why this product"}
            </p>
            <p className="text-sm leading-relaxed text-[var(--text-muted)]">{matchReason}</p>
            {evidenceCitations.length > 0 ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium text-[var(--brand)]">
                  {locale === "ko" ? "근거 보기" : "Evidence"}
                </summary>
                <ul className="mt-2 space-y-1">
                  {evidenceCitations.map((c) => (
                    <li key={c.label} className="text-[11px] text-[var(--text-muted)]">
                      <span className="font-medium text-gray-700">{c.levelKo}</span>
                      {" · "}
                      {c.href ? (
                        <a
                          href={c.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--brand)] underline underline-offset-2"
                        >
                          {c.label}
                        </a>
                      ) : (
                        <span>{c.label}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-[var(--text-subtle)]">
              {locale === "ko"
                ? "주요 매칭 성분"
                : locale === "ja"
                  ? "マッチ成分"
                  : "Matched ingredients"}
            </p>
            {matchedLabels.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {matchedLabels.map((ing) => (
                  <span
                    key={`match-${ing}`}
                    className="inline-flex rounded-md bg-[var(--brand-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--brand)]"
                  >
                    {ing}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-subtle)]">
                {locale === "ko" ? "매칭된 성분 없음" : "No matched ingredients"}
              </p>
            )}
          </div>

          {hasExcluded && excludedLabels.length > 0 ? (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-[var(--warning)]">
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
                    className="inline-flex rounded-md bg-[var(--warning-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--warning)]"
                  >
                    {ing}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {purchase && !hidePurchaseCta ? (
          <div className="flex flex-col gap-3 border-t border-[var(--border-soft)] pt-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-0.5">
              <p className="text-[11px] font-medium text-gray-700">
                {locale === "ko" ? "검증된 판매처" : "Verified retailer"}
                {purchase.isOfficial
                  ? locale === "ko"
                    ? " · 공식몰"
                    : " · Official"
                  : ""}
              </p>
              <p className="text-[11px] text-[var(--text-subtle)]">
                {retailerLabel}
                {purchase.retailerCountry ? ` · ${purchase.retailerCountry}` : ""}
              </p>
              {hasDisplayablePrice ? (
                <p className="text-sm font-semibold text-gray-900">{offerPriceLabel}</p>
              ) : (
                <p className="text-xs text-[var(--text-subtle)]">
                  {locale === "ko" ? "가격 정보 없음" : "Price unavailable"}
                </p>
              )}
              <p className="text-[10px] text-[var(--text-subtle)]">
                {purchase.verifiedAt
                  ? formatVerifiedAtForDisplay(purchase.verifiedAt, locale) ??
                    (locale === "ko" ? "확인일 정보 없음" : "Verification date unavailable")
                  : locale === "ko"
                    ? "확인일 정보 없음"
                    : "Verification date unavailable"}
              </p>
            </div>
            <a
              href={purchase.url}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="kb-btn kb-btn-primary px-4 py-2 text-xs"
            >
              {locale === "ko" ? "구매처 보기" : "View retailer"}
            </a>
          </div>
        ) : hidePurchaseCta ? (
          <p className="text-xs leading-relaxed text-[var(--text-subtle)]">
            {locale === "ko"
              ? "지금은 제품 구매보다 상태 확인이 우선입니다."
              : "Confirming your skin status comes before shopping right now."}
          </p>
        ) : (
          <p className="kb-status-info text-xs">{noPurchaseMessage}</p>
        )}
      </div>
    </article>
  );
}
