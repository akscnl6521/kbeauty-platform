import { createSupabaseServerClient } from "@/lib/supabase/server";
import { displayBrandName, displayProductTitle } from "@/lib/brand/displayBrandName";
import { isOfferEligibleForCoreRecommendation } from "@/lib/recommend/productOffer";
import type { ProductOffer } from "@/lib/recommend/catalogTypes";
import {
  normalizeShippingCountry,
  type ShippingCountry,
} from "@/lib/recommend/selectPurchaseLink";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

type ProductRow = {
  id: number | string;
  slug: string | null;
  name: string | null;
  name_ko: string | null;
  name_ja: string | null;
  brand: string | null;
  category: string | null;
  active: boolean | null;
  verified_at: string | null;
  key_ingredients: string[] | null;
  skin_concern: unknown;
  image_url: string | null;
  image_verified: boolean | null;
  source_url: string | null;
};

function asShippingCountries(raw: unknown): ShippingCountry[] {
  if (!Array.isArray(raw)) return ["KR"];
  const list = raw
    .map((c) => normalizeShippingCountry(String(c)))
    .filter((c): c is ShippingCountry => c != null);
  return list.length ? list : ["KR"];
}

function asOffers(rows: Record<string, unknown>[] | null): ProductOffer[] {
  if (!rows?.length) return [];
  return rows.map((r, i) => {
    const price = typeof r.price === "number" ? r.price : undefined;
    const currency =
      typeof r.currency === "string"
        ? (r.currency as ProductOffer["currency"])
        : undefined;
    const verifiedAt =
      typeof r.verified_at === "string" ? r.verified_at : undefined;
    return {
      id: String(r.id ?? i),
      productId: String(r.product_id ?? ""),
      retailerName: String(r.retailer_name ?? ""),
      retailerCountry: (r.retailer_country as ProductOffer["retailerCountry"]) ?? "KR",
      shipsToCountries: asShippingCountries(r.ships_to_countries),
      purchaseUrl: String(r.purchase_url ?? ""),
      ...(price != null ? { price } : {}),
      ...(currency ? { currency } : {}),
      stockStatus: (r.stock_status as ProductOffer["stockStatus"]) ?? "unknown",
      verificationStatus:
        (r.verification_status as ProductOffer["verificationStatus"]) ?? "unverified",
      ...(verifiedAt ? { verifiedAt } : {}),
      isOfficial: Boolean(r.is_official),
      active: r.active !== false,
    };
  });
}

async function loadPublicProduct(slug: string) {
  const supabase = await createSupabaseServerClient();
  const { data: product, error } = await supabase
    .from("products")
    .select(
      "id, slug, name, name_ko, name_ja, brand, category, active, verified_at, key_ingredients, skin_concern, image_url, image_verified, source_url"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (error || !product) return null;
  const row = product as ProductRow;

  // Draft / unverified must stay private
  if (row.active !== true || !row.verified_at) return null;

  const { data: offerRows } = await supabase
    .from("product_offers")
    .select(
      "id, product_id, retailer_name, retailer_country, ships_to_countries, purchase_url, price, currency, stock_status, verification_status, is_official, verified_at, active"
    )
    .eq("product_id", row.id);

  const { data: ingredientRows } = await supabase
    .from("product_ingredients")
    .select("position, ingredients ( display_name, inci_name, slug )")
    .eq("product_id", row.id)
    .order("position", { ascending: true })
    .limit(80);

  return {
    product: row,
    offers: asOffers((offerRows as Record<string, unknown>[]) ?? []),
    ingredients: (ingredientRows ?? []) as Array<{
      position: number | null;
      ingredients: {
        display_name?: string | null;
        inci_name?: string | null;
        slug?: string | null;
      } | null;
    }>,
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const data = await loadPublicProduct(slug);
    if (!data) return { title: "제품을 찾을 수 없습니다", robots: { index: false } };
    const title = displayProductTitle({
      name: data.product.name,
      nameKo: data.product.name_ko,
      nameJa: data.product.name_ja,
      brand: data.product.brand,
      locale: "ko",
    });
    return {
      title,
      description: `${title} 성분·판매처 정보 (의료 진단이 아닙니다)`,
    };
  } catch {
    return { title: "K-Beauty Match", robots: { index: false } };
  }
}

export default async function PublicProductPage({ params }: PageProps) {
  const { slug } = await params;
  let data: Awaited<ReturnType<typeof loadPublicProduct>> = null;
  try {
    data = await loadPublicProduct(slug);
  } catch {
    notFound();
  }
  if (!data) notFound();

  const { product, offers, ingredients } = data;
  const brand = displayBrandName(product.brand, "ko");
  const title = displayProductTitle({
    name: product.name,
    nameKo: product.name_ko,
    nameJa: product.name_ja,
    brand: product.brand,
    locale: "ko",
  });
  const krOffers = offers.filter((o) => isOfferEligibleForCoreRecommendation(o, "KR"));
  const imageOk = product.image_verified === true && Boolean(product.image_url?.trim());
  const concerns = Array.isArray(product.skin_concern)
    ? product.skin_concern.map(String)
    : typeof product.skin_concern === "string"
      ? [product.skin_concern]
      : [];

  return (
    <main className="kb-surface min-h-screen overflow-x-hidden text-gray-900">
      <div className="kb-container py-10 sm:py-14">
        <p className="kb-eyebrow">제품 정보</p>
        <h1 className="kb-display mt-3 max-w-3xl text-balance text-3xl sm:text-4xl">
          {title}
        </h1>
        {brand ? (
          <p className="mt-2 text-sm font-semibold tracking-wide text-[var(--text-subtle)]">
            {brand}
          </p>
        ) : null}
        {product.category ? (
          <p className="mt-1 text-sm text-[var(--text-muted)]">{product.category}</p>
        ) : null}

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-[var(--radius-panel)] bg-[var(--surface-muted)]">
            {imageOk ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.image_url!}
                alt={`${title} 제품 이미지`}
                className="aspect-square w-full object-contain p-4"
              />
            ) : (
              <div className="kb-media-fallback aspect-square">제품 이미지 준비 중</div>
            )}
          </div>

          <div className="space-y-8 min-w-0">
            <section>
              <h2 className="text-lg font-semibold">주요 성분</h2>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(product.key_ingredients ?? []).length ? (
                  (product.key_ingredients ?? []).map((ing) => (
                    <span
                      key={ing}
                      className="rounded-md bg-[var(--brand-soft)] px-2 py-0.5 text-xs font-medium text-[var(--brand)]"
                    >
                      {ing}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-[var(--text-subtle)]">주요 성분 정보가 아직 없습니다.</p>
                )}
              </div>
            </section>

            {concerns.length ? (
              <section>
                <h2 className="text-lg font-semibold">관련 피부 고민</h2>
                <p className="mt-2 text-sm text-[var(--text-muted)]">{concerns.join(" · ")}</p>
              </section>
            ) : null}

            <section>
              <h2 className="text-lg font-semibold">전성분</h2>
              {ingredients.length ? (
                <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-6 text-[var(--text-muted)]">
                  {ingredients.map((row, idx) => {
                    const ing = row.ingredients;
                    const label =
                      ing?.display_name || ing?.inci_name || ing?.slug || `성분 ${idx + 1}`;
                    return <li key={`${label}-${idx}`}>{label}</li>;
                  })}
                </ol>
              ) : (
                <p className="mt-2 text-sm text-[var(--text-subtle)]">
                  공개된 전성분 목록이 아직 연결되지 않았습니다.
                </p>
              )}
            </section>

            <section>
              <h2 className="text-lg font-semibold">한국 판매처</h2>
              {krOffers.length ? (
                <ul className="mt-3 space-y-3">
                  {krOffers.map((o) => (
                    <li key={o.id} className="border-t border-[var(--border-soft)] pt-3 text-sm">
                      <p className="font-medium">
                        {o.retailerName}
                        {o.isOfficial ? " · 공식몰" : ""}
                      </p>
                      <p className="text-[var(--text-subtle)]">
                        {o.price != null ? `${o.price.toLocaleString("ko-KR")} ${o.currency}` : "가격 정보 없음"}
                        {o.stockStatus ? ` · ${o.stockStatus}` : ""}
                      </p>
                      <a
                        href={o.purchaseUrl}
                        target="_blank"
                        rel="noopener noreferrer sponsored"
                        className="kb-btn kb-btn-primary mt-2 px-4 py-2 text-xs"
                      >
                        구매처 보기
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="kb-status-info mt-3 text-sm">
                  현재 확인된 한국 판매처가 없습니다. 확인 후 다시 안내합니다.
                </p>
              )}
            </section>

            <section className="space-y-2 text-sm text-[var(--text-muted)]">
              {product.source_url ? (
                <p>
                  공식 출처:{" "}
                  <a
                    href={product.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--brand)] underline-offset-4 hover:underline"
                  >
                    원문 보기
                  </a>
                </p>
              ) : null}
              <p>데이터 확인: {product.verified_at}</p>
            </section>
          </div>
        </div>

        <p className="mt-12 text-xs leading-5 text-[var(--text-subtle)]">
          의료 진단·치료를 대체하지 않습니다.{" "}
          <Link href="/privacy" className="underline underline-offset-2">
            개인정보
          </Link>
          {" · "}
          <Link href="/results" className="underline underline-offset-2">
            추천 결과로 돌아가기
          </Link>
        </p>
      </div>
    </main>
  );
}
