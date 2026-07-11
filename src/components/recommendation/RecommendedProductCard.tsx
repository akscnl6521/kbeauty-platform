import type { CandidateProduct, RankedProduct } from "@/lib/recommend";

export type RecommendedProductCardProps = {
  /** 1부터 시작하는 순위 */
  rank: number;
  ranked: RankedProduct<CandidateProduct>;
  /** 표시용 로케일 (이름 선택) */
  locale?: "en" | "ja" | "ko";
};

/**
 * Sprint 3 Phase 1 — 랭킹된 추천 제품 카드.
 * LocalStorage(skinRankedProducts) 항목을 표시한다. 구매 링크는 포함하지 않는다.
 */
export function RecommendedProductCard({
  rank,
  ranked,
  locale = "en",
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

  return (
    <article
      className="flex flex-col gap-3 rounded-2xl border border-pink-100 bg-white p-4 shadow-sm sm:p-5"
      data-product-id={product.id}
    >
      <div className="flex items-start gap-3">
        {/* 순위 */}
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

      {/* 매칭 성분 */}
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          매칭 성분
        </p>
        {matchedIngredients.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {matchedIngredients.map((ing) => (
              <span
                key={`match-${ing}`}
                className="inline-flex rounded-full bg-[#C2185B]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#C2185B] sm:text-xs"
              >
                {ing}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400">매칭된 성분 없음</p>
        )}
      </div>

      {/* 회피 성분 — 있을 때만 */}
      {hasExcluded ? (
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
            주의 성분
          </p>
          <div className="flex flex-wrap gap-1.5">
            {excludedIngredients.map((ing) => (
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

      {/* 가격 — 있을 때만 */}
      {price != null ? (
        <p className="text-xs text-gray-600 sm:text-sm">
          <span className="font-medium text-gray-800">USD</span>{" "}
          {price.toFixed(2)}
        </p>
      ) : null}
    </article>
  );
}
