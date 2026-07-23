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
import {
  isOfferEligibleForCoreRecommendation,
  isOfferEligibleForRecommendation,
  resolveProductOffers,
} from "@/lib/recommend/productOffer";
import {
  commerceFitButUnavailableMessageKo,
  commerceStatusLabelEn,
  commerceStatusLabelKo,
  deriveCommerceAvailability,
  isRecommendCommerceSeparationEnabled,
} from "@/lib/recommend/commerceStatus";
import {
  normalizeShippingCountry,
  type ShippingCountry,
} from "@/lib/recommend/selectPurchaseLink";
import ProductUsageGuide from "@/components/usage/ProductUsageGuide";
import { CommerceLaneBadge } from "@/components/commerce/CommerceLaneBadge";

export type RecommendedProductCardProps = {
  /** 1부터 시작하는 순위 */
  rank: number;
  ranked: RankedProduct<CandidateProduct>;
  /** 표시용 로케일 (이름 선택) */
  locale?: "en" | "ja" | "ko";
  /** LocalStorage countryCode (구매 링크 선택) */
  countryCode?: string | null;
  /** expert_first 등: 구매처 링크·가격 강조 숨김 (데이터는 유지) */
  hidePurchaseCta?: boolean;
  /** 사용자 분석/선택 기반 연결 이유 (있으면 표시) */
  recommendation?: Recommendation | null;
  /** 보조 관리 모드 라벨 */
  softCareMode?: boolean;
  /**
   * 부위 화면에서 전달된 applicationArea 필터.
   * 지정 시 검증된 가이드 중 부위가 일치할 때만 표시.
   */
  applicationAreas?: readonly string[];
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
  applicationAreas,
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
  const resolvedOffers = resolveProductOffers(product);
  const commerceSeparation = isRecommendCommerceSeparationEnabled();
  const hasPurchasableOffer = resolvedOffers.some((o) =>
    isOfferEligibleForCoreRecommendation(o, shipping)
  );
  const hasRecommendationOffer = resolvedOffers.some((o) =>
    isOfferEligibleForRecommendation(o, shipping)
  );
  /** Trust: purchasable verified = fully ready; else recommendation-eligible offer still counts as presence */
  const hasVerifiedOffer = hasPurchasableOffer;
  const trustStatus = getProductTrustStatus({
    productVerifiedAt: (product as { verified_at?: string | null }).verified_at,
    hasVerifiedOffer,
    hasAnyOffer:
      resolvedOffers.length > 0 || hasRecommendationOffer,
  });
  const trustLabel =
    trustStatus === "manual_review"
      ? null
      : productTrustStatusLabel(trustStatus, locale);
  const hasExcluded =
    Array.isArray(excludedIngredients) && excludedIngredients.length > 0;

  const matchedLabels = displayIngredientNames(matchedIngredients, locale);
  const excludedLabels = displayIngredientNames(excludedIngredients, locale);

  /** CTA only when purchasable (in_stock verified) — never for OOS */
  const purchase = selectPurchaseLink(product, countryCode);
  const commerce = deriveCommerceAvailability({
    offers: resolvedOffers,
    shippingCountry: shipping,
    productStatus: (product as { product_status?: string | null }).product_status as
      | "active"
      | "draft"
      | "sample"
      | "discontinued"
      | null
      | undefined,
  });
  const commerceLabel =
    locale === "ko"
      ? commerceStatusLabelKo(commerce.commerce_status)
      : commerceStatusLabelEn(commerce.commerce_status);
  const fitButUnavailableKo =
    commerceSeparation && !purchase
      ? commerceFitButUnavailableMessageKo(commerce.commerce_status)
      : null;

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
          lastCheckedLabel
            ? ` 마지막 확인: ${lastCheckedLabel}`
            : ""
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
      ? "제품 이미지 준비 중"
      : locale === "ja"
        ? "製品画像準備中"
        : "Product image coming soon";

  return (
    <article
      className="flex flex-col gap-3 rounded-2xl border border-pink-100 bg-white p-4 shadow-sm sm:p-5"
      data-product-id={product.id}
    >
      <div className="overflow-hidden rounded-xl bg-[#F7F1EC]">
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
            className="flex h-full w-full items-center justify-center px-4 text-center text-xs text-gray-500"
            hidden={Boolean(verifiedImage)}
            role="img"
            aria-label={imageFallback}
          >
            {imageFallback}
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#C2185B] text-xs font-bold text-white"
          aria-label={`순위 ${rank}`}
        >
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          {brand ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500 sm:text-xs">
                {brand}
              </p>
              {showKoreanBadge ? (
                <span className="inline-flex rounded-md border border-[#C2185B]/25 bg-[#C2185B]/08 px-1.5 py-0.5 text-[10px] font-semibold text-[#C2185B]">
                  {locale === "ko"
                    ? "한국 브랜드"
                    : locale === "ja"
                      ? "K-Beauty"
                      : "K-Beauty"}
                </span>
              ) : null}
              {softCareMode ? (
                <span className="inline-flex rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                  {locale === "ko"
                    ? "보조 관리 참고"
                    : locale === "ja"
                      ? "補助ケア参考"
                      : "Supportive care"}
                </span>
              ) : null}
            </div>
          ) : null}
          <h3 className="mt-0.5 text-sm font-semibold leading-snug text-gray-900 sm:text-base">
            {displayName}
          </h3>
          {(sizeLabel || formLabel) && (
            <p className="mt-0.5 text-xs text-gray-500">
              {[sizeLabel, formLabel].filter(Boolean).join(" · ")}
            </p>
          )}
          {trustLabel ? (
            <p className="mt-1 text-[11px] text-gray-500">{trustLabel}</p>
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

      {matchReason ? (
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            {locale === "ko"
              ? "추천 이유"
              : locale === "ja"
                ? "おすすめ理由"
                : "Why this product"}
          </p>
          <p className="text-xs leading-relaxed text-gray-700">{matchReason}</p>
          {evidenceCitations.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {evidenceCitations.map((c) => (
                <li key={c.label} className="text-[11px] text-gray-600">
                  <span className="font-medium text-gray-700">{c.levelKo}</span>
                  {" · "}
                  {c.href ? (
                    <a
                      href={c.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#C2185B] underline hover:no-underline"
                    >
                      {c.label}
                    </a>
                  ) : (
                    <span>{c.label}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

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

      <ProductUsageGuide
        productId={product.id}
        locale={locale}
        emptyMode="hidden"
        applicationAreas={applicationAreas}
        className="border-t border-pink-100 pt-3 text-xs text-gray-700"
      />

      {commerceSeparation ? (
        <div className="mt-1 space-y-1 border-t border-pink-50 pt-3">
          {locale === "ko" ? <CommerceLaneBadge lane="organic" /> : null}
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            {locale === "ko"
              ? "추천 적합 · 구매 상태"
              : locale === "ja"
                ? "適合・購入状態"
                : "Fit · purchase status"}
          </p>
          <p className="text-[11px] text-gray-700 sm:text-xs">
            {locale === "ko" ? "추천 적합 제품" : "Recommendation fit"}
            {" · "}
            <span
              className={
                commerce.commerce_status === "in_stock"
                  ? "font-medium text-emerald-800"
                  : "font-medium text-amber-800"
              }
            >
              {commerceLabel}
            </span>
          </p>
          {commerce.checked_at || lastCheckedLabel ? (
            <p className="text-[10px] text-gray-400">
              {locale === "ko"
                ? "공식 판매처 확인 시각"
                : locale === "ja"
                  ? "公式販売先確認時刻"
                  : "Official retailer checked at"}
              {": "}
              {formatVerifiedAtForDisplay(
                commerce.checked_at ?? lastCheckedRaw,
                locale
              ) ?? lastCheckedLabel}
            </p>
          ) : null}
        </div>
      ) : null}

      {purchase && !hidePurchaseCta && hasPurchasableOffer ? (
        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-0.5">
            <p className="text-[11px] font-medium text-gray-700 sm:text-xs">
              {locale === "ko" ? "검증된 판매처" : locale === "ja" ? "確認済み販売先" : "Verified retailer"}
              {purchase.isOfficial
                ? locale === "ko"
                  ? " · 공식몰"
                  : locale === "ja"
                    ? " · 公式"
                    : " · Official"
                : ""}
            </p>
            <p className="text-[11px] text-gray-500 sm:text-xs">
              {retailerLabel}
              {purchase.retailerCountry
                ? ` · ${purchase.retailerCountry}`
                : ""}
            </p>
            {hasDisplayablePrice ? (
              <p className="text-sm font-semibold text-gray-900">
                {offerPriceLabel}
              </p>
            ) : (
              <p className="text-xs text-gray-500">
                {locale === "ko"
                  ? "가격 정보 없음"
                  : locale === "ja"
                    ? "価格情報なし"
                    : "Price unavailable"}
              </p>
            )}
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
      ) : hidePurchaseCta ? (
        <p className="mt-1 text-[11px] leading-relaxed text-gray-500 sm:text-xs">
          {locale === "ko"
            ? "지금은 제품 구매보다 상태 확인이 우선입니다."
            : locale === "ja"
              ? "今は購入より状態確認が優先です。"
              : "Confirming your skin status comes before shopping right now."}
        </p>
      ) : (
        <p className="mt-1 text-[11px] leading-relaxed text-gray-500 sm:text-xs">
          {fitButUnavailableKo && locale === "ko"
            ? fitButUnavailableKo
            : noPurchaseMessage}
        </p>
      )}
    </article>
  );
}
