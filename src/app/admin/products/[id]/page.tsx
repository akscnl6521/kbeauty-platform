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

function DetailBody({ data }: { data: AdminProductDetailPayload }) {
  const { product, variants, ingredients, offers, statusSummary } = data;

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
        </dl>
        {!statusSummary.recommendationEligible ? (
          <p className="mt-3 text-sm text-amber-800">
            현재 추천 엔진 사용 불가. active·product verified·approved 구조화
            성분·verified in-stock offer가 모두 필요합니다.
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
          <p className="text-sm text-amber-800">
            검증된 판매처 없음 — product_offers 0건. 레거시 링크는 verified
            offer가 아닙니다.
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

      <Section title="Variants">
        {variants.length === 0 ? (
          <p className="text-sm text-gray-500">등록된 variant 없음</p>
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
  let loadFailed = false;

  try {
    data = await getAdminProductDetail(productId);
  } catch (error) {
    loadFailed = true;
    if (!(error instanceof AdminConfigurationError)) {
      loadFailed = true;
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
          <DetailBody data={data} />
        )}
      </div>
    </main>
  );
}
