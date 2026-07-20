import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { requireAdminUser } from "@/lib/auth/admin";
import { AdminConfigurationError } from "@/lib/auth/errors";
import {
  getAdminProductDetail,
  parseAdminProductId,
  type AdminProductDetailPayload,
  type AdminProductOfferItem,
} from "@/lib/admin/product-detail";
import {
  USAGE_MEDIA_SCHEMA_GAPS,
  getAdminProductUsageMediaReview,
  type AdminCatalogMediaReviewItem,
  type AdminProductUsageMediaReview,
} from "@/lib/admin/product-usage-media";
import { AdminLogoutButton } from "../../AdminLogoutButton";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin Product Detail | K-Beauty Match",
  robots: { index: false, follow: false },
};

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10 border-t border-[#E8DFD8] pt-6">
      <h2 className="text-lg font-semibold tracking-tight text-gray-900">
        {title}
      </h2>
      {description ? (
        <p className="mt-1 text-sm text-gray-600">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function BoolLabel({ value }: { value: boolean | null | undefined }) {
  if (value === true) return <span className="font-medium">true</span>;
  if (value === false) return <span className="font-medium">false</span>;
  return <span className="text-gray-400">—</span>;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toISOString().slice(0, 10);
}

function OfferLink({ offer }: { offer: AdminProductOfferItem }) {
  if (!offer.purchaseUrlSafeHttps) {
    return <span className="text-xs text-gray-400">링크 비활성</span>;
  }

  return (
    <a
      href={offer.purchaseUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm font-medium text-[#8B6914] underline"
    >
      판매처 열기
    </a>
  );
}

function SafeHttpsLink({
  href,
  label,
}: {
  href: string | null | undefined;
  label: string;
}) {
  if (!href || !href.trim()) {
    return <span className="text-xs text-gray-400">URL 없음</span>;
  }
  try {
    if (new URL(href).protocol !== "https:") {
      return (
        <span className="break-all text-xs text-gray-400" title={href}>
          HTTPS 아님 · 클릭 불가
        </span>
      );
    }
  } catch {
    return <span className="text-xs text-gray-400">URL 형식 오류</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="break-all text-sm font-medium text-[#8B6914] underline"
    >
      {label}
    </a>
  );
}

function ChecklistRow({
  ok,
  label,
  note,
}: {
  ok: boolean | null;
  label: string;
  note?: string;
}) {
  const mark =
    ok === true ? "예" : ok === false ? "아니오" : "스키마 없음";
  return (
    <li className="text-sm text-gray-800">
      <span className="font-medium">{label}:</span> {mark}
      {note ? <span className="text-gray-500"> ({note})</span> : null}
    </li>
  );
}

function UsageMediaCard({ item }: { item: AdminCatalogMediaReviewItem }) {
  return (
    <article className="rounded-lg border border-[#E8DFD8] bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded border border-[#E8DFD8] bg-[#FAF7F5] px-2 py-0.5 text-xs font-medium text-gray-800">
          상태: {item.statusLabel}
        </span>
        <span className="rounded border border-[#E8DFD8] px-2 py-0.5 text-xs text-gray-700">
          validation: {item.validationStatus}
        </span>
        <span className="rounded border border-[#E8DFD8] px-2 py-0.5 text-xs text-gray-700">
          rights: {item.usageRightsStatus}
        </span>
        <span
          className={
            item.displayEligible
              ? "rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-900"
              : "rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900"
          }
        >
          사용자 화면 표시 자격: {item.displayEligible ? "가능" : "불가"}
        </span>
      </div>

      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-gray-500">미디어 ID</dt>
          <dd className="break-all font-mono text-xs">{item.id}</dd>
        </div>
        <div>
          <dt className="text-gray-500">제품 ID</dt>
          <dd className="tabular-nums">{item.productId ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">staging_product_id</dt>
          <dd className="break-all font-mono text-xs">
            {item.stagingProductId ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">variant_key / shade</dt>
          <dd>
            {item.variantKey ?? "—"}
            {item.shadeName ? ` / ${item.shadeName}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">media_type</dt>
          <dd>{item.mediaType}</dd>
        </div>
        <div>
          <dt className="text-gray-500">source_type / tier</dt>
          <dd>
            {item.sourceType} · tier {item.sourceTier}
            {item.isOfficialSource ? " · official" : ""}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">source_domain</dt>
          <dd>{item.sourceDomain || "—"}</dd>
        </div>
        <div>
          <dt className="text-gray-500">mime / size</dt>
          <dd>
            {item.mimeType ?? "—"}
            {item.width != null && item.height != null
              ? ` · ${item.width}×${item.height}`
              : ""}
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">verified_at</dt>
          <dd className="tabular-nums">{formatDate(item.verifiedAt)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">last_checked_at</dt>
          <dd className="tabular-nums">{formatDate(item.lastCheckedAt)}</dd>
        </div>
        <div>
          <dt className="text-gray-500">is_primary / accessible / fixture</dt>
          <dd>
            primary=<BoolLabel value={item.isPrimary} /> · accessible=
            <BoolLabel value={item.isAccessible} /> · fixture=
            <BoolLabel value={item.isFixture} />
          </dd>
        </div>
        <div>
          <dt className="text-gray-500">rights_notes</dt>
          <dd className="text-xs text-gray-700">{item.rightsNotes ?? "—"}</dd>
        </div>
      </dl>

      <div className="mt-3 space-y-1 text-sm">
        <p>
          <span className="text-gray-500">image_url: </span>
          <SafeHttpsLink href={item.imageUrl} label="이미지 열기" />
        </p>
        <p>
          <span className="text-gray-500">canonical_image_url: </span>
          <SafeHttpsLink
            href={item.canonicalImageUrl}
            label="canonical 열기"
          />
        </p>
        <p>
          <span className="text-gray-500">source_page_url: </span>
          <SafeHttpsLink href={item.sourcePageUrl} label="출처 페이지 열기" />
        </p>
      </div>

      {!item.displayEligible && item.ineligibilityReasons.length > 0 ? (
        <div className="mt-3 rounded border border-amber-100 bg-amber-50/80 px-3 py-2">
          <p className="text-xs font-semibold text-amber-900">표시 불가 사유</p>
          <ul className="mt-1 list-disc pl-5 text-xs text-amber-900">
            {item.ineligibilityReasons.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3">
        <p className="text-xs font-semibold text-gray-800">검수 체크리스트</p>
        <ul className="mt-1 space-y-0.5">
          <ChecklistRow ok={item.checklist.httpsSource} label="HTTPS 출처인가" />
          <ChecklistRow
            ok={item.checklist.sourceTypePresent}
            label="출처 유형이 확인되었는가"
          />
          <ChecklistRow
            ok={item.checklist.productLinked}
            label="제품 또는 variant 연결이 있는가"
          />
          <ChecklistRow
            ok={item.checklist.rightsStatusValid}
            label="권리 상태가 유효한가"
          />
          <ChecklistRow
            ok={item.checklist.rightsEndDateOk}
            label="권리 종료일이 지나지 않았는가"
            note="rights_ends_at 컬럼 없음"
          />
          <ChecklistRow
            ok={item.checklist.verifiedAtPresent}
            label="검증일(verified_at)이 존재하는가"
          />
          <ChecklistRow
            ok={
              item.checklist.disclosureRequired
                ? item.checklist.disclosurePresent
                : true
            }
            label="광고·협찬·AI 생성 고지가 필요한가 / 문구 존재"
            note={
              item.checklist.disclosureRequired
                ? "disclosure_text 컬럼 없음"
                : "공식 등 — 고지 강제 아님"
            }
          />
          <ChecklistRow
            ok={item.checklist.displayEligible}
            label="사용자 화면 표시 자격이 있는가"
          />
        </ul>
      </div>
    </article>
  );
}

function UsageMediaReviewSection({
  review,
}: {
  review: AdminProductUsageMediaReview;
}) {
  return (
    <Section
      title="사용 영상·가이드 검수"
      description="catalog_product_media SELECT 전용. 승인·삭제·상태 변경 없음. 자동재생·iframe 임베드 없음."
    >
      <div className="mb-4 rounded-lg border border-[#E8DFD8] bg-[#FAF7F5] px-3 py-2 text-xs text-gray-700">
        <p className="font-semibold text-gray-900">스키마 참고</p>
        <p className="mt-1">
          사용 가이드 전용 테이블:{" "}
          {review.usageGuideTablePresent
            ? "있음"
            : "없음 (LocalStorage / 정책 레이어만)"}
        </p>
        <ul className="mt-1 list-disc pl-5">
          {review.schemaGaps.map((gap) => (
            <li key={gap}>현재 스키마에 없음 — {gap}</li>
          ))}
        </ul>
      </div>

      {review.loadError ? (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          미디어 조회 오류 (빈 목록과 구분됨): {review.loadError}
        </div>
      ) : review.items.length === 0 ? (
        <p className="text-sm text-gray-500">
          연결된 미디어 없음 (catalog_product_media에 product_id 행이 없습니다).
          사용 가이드 전용 DB 행도 없습니다.
        </p>
      ) : (
        <div className="space-y-4">
          {review.items.map((item) => (
            <UsageMediaCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </Section>
  );
}

function StringList({
  items,
  empty,
}: {
  items: string[];
  empty: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">{empty}</p>;
  }

  return (
    <ul className="list-disc space-y-1 pl-5 text-sm text-gray-800">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function DetailBody({
  data,
  usageMediaReview,
}: {
  data: AdminProductDetailPayload;
  usageMediaReview: AdminProductUsageMediaReview;
}) {
  const { product, variants, ingredients, offers, statusSummary, primaryMedia } =
    data;

  return (
    <>
      <Section title="기본 정보">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">ID</dt>
            <dd className="font-medium tabular-nums">{product.id}</dd>
          </div>
          <div>
            <dt className="text-gray-500">제품명</dt>
            <dd className="font-medium">{product.name}</dd>
          </div>
          <div>
            <dt className="text-gray-500">slug</dt>
            <dd>{product.slug ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">브랜드</dt>
            <dd>{product.brand}</dd>
          </div>
          <div>
            <dt className="text-gray-500">카테고리</dt>
            <dd>{product.category ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">active</dt>
            <dd>
              <BoolLabel value={product.active} />
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">created_at</dt>
            <dd className="tabular-nums">{formatDate(product.createdAt)}</dd>
          </div>
        </dl>
      </Section>

      <Section title="제품 이미지" description="catalog_product_media 연결">
        {primaryMedia?.imageUrl ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={primaryMedia.imageUrl}
              alt={`${product.brand} ${product.name} 제품 이미지`}
              className="h-40 w-40 rounded-lg border border-[#E8DFD8] object-contain bg-white"
            />
            <dl className="text-sm text-gray-700">
              <div>
                <dt className="text-gray-500">validation</dt>
                <dd>{primaryMedia.validationStatus}</dd>
              </div>
              <div className="mt-1 break-all text-xs text-gray-500">
                {primaryMedia.imageUrl}
              </div>
            </dl>
          </div>
        ) : (
          <p className="text-sm text-gray-500">연결된 이미지 없음</p>
        )}
      </Section>

      <UsageMediaReviewSection review={usageMediaReview} />

      <Section
        title="검증 상태"
        description="레거시 링크·price_usd만으로는 추천 자격이 되지 않습니다."
      >
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">verified_at</dt>
            <dd className="tabular-nums">{formatDate(product.verifiedAt)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">data_confidence</dt>
            <dd>{product.dataConfidence ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">productVerified</dt>
            <dd>
              <BoolLabel value={statusSummary.productVerified} />
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">structuredIngredientsComplete</dt>
            <dd>
              <BoolLabel value={statusSummary.structuredIngredientsComplete} />
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">hasVerifiedOffer</dt>
            <dd>
              <BoolLabel value={statusSummary.hasVerifiedOffer} />
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">recommendationEligible</dt>
            <dd>
              <BoolLabel value={statusSummary.recommendationEligible} />
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">KR eligible offers</dt>
            <dd className="tabular-nums">
              {statusSummary.countryEligibleOfferCountKr}
            </dd>
          </div>
        </dl>
        {statusSummary.verificationBlockers.length > 0 ? (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <p className="font-medium">검증 실패/미충족</p>
            <ul className="mt-1 list-disc pl-5">
              {statusSummary.verificationBlockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {statusSummary.recommendationBlockers.length > 0 ? (
          <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
            <p className="font-medium">추천 eligibility 실패 이유</p>
            <ul className="mt-1 list-disc pl-5">
              {statusSummary.recommendationBlockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {!statusSummary.recommendationEligible ? (
          <p className="mt-3 text-sm text-amber-800">
            현재 추천 엔진 사용 불가. active·product verified·approved 구조화
            성분·KR verified in-stock offer가 모두 필요합니다. (가짜 Top5 패딩
            없음)
          </p>
        ) : null}
      </Section>

      <Section title="제품 특성">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">usage_area</dt>
            <dd>{product.usageArea ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">texture</dt>
            <dd>{product.texture ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">fragrance_free</dt>
            <dd>
              <BoolLabel value={product.fragranceFree} />
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">alcohol_free</dt>
            <dd>
              <BoolLabel value={product.alcoholFree} />
            </dd>
          </div>
        </dl>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-gray-500">skin concern</p>
            <StringList
              items={product.skinConcern}
              empty="등록된 skin concern 없음"
            />
          </div>
          <div>
            <p className="text-sm text-gray-500">skin tone</p>
            <StringList items={product.skinTone} empty="등록된 skin tone 없음" />
          </div>
        </div>
        {product.recommendationReason ? (
          <p className="mt-4 text-sm text-gray-700">
            <span className="text-gray-500">recommendation_reason: </span>
            {product.recommendationReason}
          </p>
        ) : null}
      </Section>

      <Section
        title="성분"
        description="구조화 성분과 레거시 배열을 검증 완료로 혼동하지 않습니다."
      >
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">
              key_ingredients (레거시)
            </h3>
            <div className="mt-2">
              <StringList
                items={product.keyIngredients}
                empty="레거시 key_ingredients 없음"
              />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">
              full_ingredients (레거시)
            </h3>
            <div className="mt-2">
              <StringList
                items={product.fullIngredients}
                empty="레거시 full_ingredients 없음"
              />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800">
              product_ingredients (구조화)
            </h3>
            {ingredients.length === 0 ? (
              <p className="mt-2 text-sm text-amber-800">
                미구조화 — 구조화 전성분 0건. 레거시 배열만으로는 검증 완료가
                아닙니다.
              </p>
            ) : (
              <div className="mt-2 overflow-x-auto rounded-lg border border-[#E8DFD8] bg-white">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase text-gray-600">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">성분</th>
                      <th className="px-3 py-2">status</th>
                      <th className="px-3 py-2">source</th>
                      <th className="px-3 py-2">verified_at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ingredients.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-[#F0E8E2] last:border-0"
                      >
                        <td className="px-3 py-2 tabular-nums">
                          {item.ingredientOrder}
                        </td>
                        <td className="px-3 py-2">
                          {item.ingredientNameKo ||
                            item.ingredientNameEn ||
                            `#${item.ingredientId}`}
                          {item.isKeyIngredient ? (
                            <span className="ml-2 text-xs text-gray-500">
                              key
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          {item.verificationStatus}
                          {item.isApprovedStructured ? (
                            <span className="ml-1 text-xs text-green-700">
                              approved✓
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">
                          {item.sourceType ?? "—"}
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {formatDate(item.verifiedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </Section>

      <Section title="판매처 (product_offers)">
        {offers.length === 0 ? (
          <p className="text-sm text-gray-600">
            아직 등록된 판매 정보가 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#E8DFD8] bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-3 py-2">retailer</th>
                  <th className="px-3 py-2">국가</th>
                  <th className="px-3 py-2">배송</th>
                  <th className="px-3 py-2">가격</th>
                  <th className="px-3 py-2">재고</th>
                  <th className="px-3 py-2">verification</th>
                  <th className="px-3 py-2">공식</th>
                  <th className="px-3 py-2">확인일</th>
                  <th className="px-3 py-2">URL</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((offer) => (
                  <tr
                    key={offer.id}
                    className="border-b border-[#F0E8E2] last:border-0"
                  >
                    <td className="px-3 py-2">{offer.retailerName}</td>
                    <td className="px-3 py-2">{offer.retailerCountry}</td>
                    <td className="px-3 py-2 text-xs">
                      {offer.shipsToCountries.join(", ") || "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {offer.price == null
                        ? "—"
                        : `${offer.price} ${offer.currency ?? ""}`.trim()}
                    </td>
                    <td className="px-3 py-2">{offer.stockStatus}</td>
                    <td className="px-3 py-2">
                      {offer.verificationStatus}
                      {offer.qualifiesAsVerifiedOffer ? (
                        <span className="ml-1 text-xs text-green-700">
                          eligible
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <BoolLabel value={offer.isOfficial} />
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatDate(offer.lastCheckedAt)}
                    </td>
                    <td className="px-3 py-2">
                      <OfferLink offer={offer} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title="레거시 데이터"
        description="레거시 참고값이며 verified offer가 아닙니다."
      >
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          price_usd·link_*·where_to_find_* 는 참고용입니다. 추천/검증 완료로
          취급하지 마세요.
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">price_usd</dt>
            <dd className="tabular-nums">
              {product.legacy.priceUsd == null
                ? "—"
                : product.legacy.priceUsd}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">where_to_find_us</dt>
            <dd>{product.legacy.whereToFindUs ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">where_to_find_jp</dt>
            <dd>{product.legacy.whereToFindJp ?? "—"}</dd>
          </div>
        </dl>
        <ul className="mt-4 space-y-2 text-sm">
          {product.legacy.links.length === 0 ? (
            <li className="text-gray-500">레거시 링크 없음</li>
          ) : (
            product.legacy.links.map((link) => (
              <li key={link.key} className="flex flex-wrap items-center gap-2">
                <span className="text-gray-500">{link.key}</span>
                {link.safeHttps ? (
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[#8B6914] underline"
                  >
                    판매처 열기
                  </a>
                ) : (
                  <span className="text-gray-400">링크 비활성</span>
                )}
              </li>
            ))
          )}
        </ul>
      </Section>

      <Section title="옵션 (variants)">
        {variants.length === 0 ? (
          <p className="text-sm text-gray-600">
            아직 등록된 옵션이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#E8DFD8] bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-[#E8DFD8] bg-[#F7F1EC] text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-3 py-2">이름</th>
                  <th className="px-3 py-2">국가</th>
                  <th className="px-3 py-2">사이즈</th>
                  <th className="px-3 py-2">status</th>
                  <th className="px-3 py-2">active</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((variant) => (
                  <tr
                    key={variant.id}
                    className="border-b border-[#F0E8E2] last:border-0"
                  >
                    <td className="px-3 py-2">
                      {variant.variantName ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {variant.countryCode ?? "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {variant.sizeValue == null
                        ? "—"
                        : `${variant.sizeValue} ${variant.sizeUnit ?? ""}`.trim()}
                    </td>
                    <td className="px-3 py-2">
                      {variant.verificationStatus}
                    </td>
                    <td className="px-3 py-2">
                      <BoolLabel value={variant.active} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}

/**
 * Read-only admin product detail page.
 */
export default async function AdminProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminUser();

  const { id: rawId } = await params;
  const productId = parseAdminProductId(rawId);
  if (productId == null) {
    notFound();
  }

  let data: AdminProductDetailPayload | null = null;
  let usageMediaReview: AdminProductUsageMediaReview = {
    items: [],
    loadError: null,
    schemaGaps: USAGE_MEDIA_SCHEMA_GAPS,
    usageGuideTablePresent: false,
  };
  let loadFailed = false;

  try {
    data = await getAdminProductDetail(productId);
  } catch {
    loadFailed = true;
  }

  if (!loadFailed && data) {
    try {
      usageMediaReview = await getAdminProductUsageMediaReview(productId);
    } catch (error) {
      usageMediaReview = {
        items: [],
        loadError:
          error instanceof AdminConfigurationError
            ? "관리자 설정 오류로 미디어를 조회하지 못했습니다."
            : "미디어 조회 중 오류가 발생했습니다.",
        schemaGaps: USAGE_MEDIA_SCHEMA_GAPS,
        usageGuideTablePresent: false,
      };
    }
  }

  if (!loadFailed && !data) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-10 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8B6914]">
              Admin
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">
                {data?.product.name ?? "제품 상세"}
              </h1>
              <span className="rounded border border-[#E8DFD8] bg-white px-2 py-0.5 text-xs font-medium text-gray-700">
                읽기 전용
              </span>
            </div>
          </div>
          <AdminLogoutButton className="shrink-0 rounded-lg border border-[#E8DFD8] bg-white px-3 py-1.5 text-sm font-medium text-gray-800" />
        </div>

        <p className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link
            href="/admin/products"
            className="font-medium text-[#8B6914] underline"
          >
            목록으로 돌아가기
          </Link>
          <Link href="/admin" className="font-medium text-[#8B6914] underline">
            대시보드로 돌아가기
          </Link>
        </p>

        {loadFailed || !data ? (
          <div
            className="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            제품 상세를 불러오지 못했습니다.{" "}
            <Link href="/admin/products" className="font-medium underline">
              목록으로 이동
            </Link>
          </div>
        ) : (
          <DetailBody data={data} usageMediaReview={usageMediaReview} />
        )}
      </div>
    </main>
  );
}
