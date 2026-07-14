import Link from "next/link";
import { requireAdminUser } from "@/lib/auth/admin";
import { getAdminProductDetail } from "@/lib/admin/product-detail";
import { AdminLogoutButton } from "../../../AdminLogoutButton";
import { AdminSubnav } from "../../../AdminSubnav";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "등록 완료 | K-Beauty Match",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams?: Promise<{ id?: string }> | { id?: string };
};

export default async function AdminProductRegisterCompletePage({
  searchParams,
}: Props) {
  await requireAdminUser();

  const resolved =
    searchParams && typeof (searchParams as Promise<unknown>).then === "function"
      ? await (searchParams as Promise<{ id?: string }>)
      : ((searchParams as { id?: string } | undefined) ?? {});
  const rawId = resolved.id ?? "";
  const productId = Number(rawId);

  if (!Number.isFinite(productId) || productId <= 0) {
    return (
      <main className="min-h-screen bg-[#FAF7F5] px-4 py-8 text-gray-900 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-bold">등록 결과를 찾을 수 없습니다</h1>
          <p className="mt-2 text-sm text-gray-600">
            제품 ID가 없습니다. 목록에서 다시 확인해 주세요.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/admin/products/new"
              className="rounded bg-[#8B6914] px-4 py-2 text-sm text-white"
            >
              새 제품 등록
            </Link>
            <Link
              href="/admin/products"
              className="rounded border border-[#E8DFD8] bg-white px-4 py-2 text-sm"
            >
              제품 목록
            </Link>
          </div>
        </div>
      </main>
    );
  }

  let detail;
  try {
    detail = await getAdminProductDetail(productId);
  } catch {
    detail = null;
  }

  if (!detail) {
    return (
      <main className="min-h-screen bg-[#FAF7F5] px-4 py-8 text-gray-900 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-bold">등록 제품을 불러오지 못했습니다</h1>
          <p className="mt-2 text-sm text-gray-600">제품 ID: {productId}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/admin/products/${productId}`}
              className="rounded bg-[#8B6914] px-4 py-2 text-sm text-white"
            >
              상세 보기 시도
            </Link>
            <Link
              href="/admin/products/new"
              className="rounded border border-[#E8DFD8] bg-white px-4 py-2 text-sm"
            >
              새 제품 등록
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const { product, ingredients, offers, variants, primaryMedia } = detail;
  const fullCount = Array.isArray(product.fullIngredients)
    ? product.fullIngredients.length
    : 0;
  const keyList =
    product.keyIngredients.length > 0
      ? product.keyIngredients
      : ingredients
          .filter((i) => i.isKeyIngredient)
          .map(
            (i) =>
              i.ingredientNameEn ||
              i.ingredientNameKo ||
              `#${i.ingredientId}`
          );
  const imageUrl = primaryMedia?.imageUrl ?? null;

  return (
    <main className="min-h-screen bg-[#FAF7F5] px-4 py-8 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B6914]">
              관리자
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              제품 등록이 완료되었습니다
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              아래에서 바로 확인하고, 필요하면 상세 페이지로 이동하세요.
            </p>
          </div>
          <AdminLogoutButton />
        </div>
        <AdminSubnav current="products" />

        <section className="mt-6 space-y-5 rounded-xl border border-[#E8DFD8] bg-white p-5 sm:p-6">
          <div>
            <p className="text-xs text-gray-500">제품 ID</p>
            <p className="text-lg font-semibold tabular-nums">{product.id}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">제품명</p>
            <p className="text-lg font-semibold">{product.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">브랜드</p>
            <p className="font-medium">{product.brand}</p>
          </div>

          <div>
            <p className="mb-2 text-xs text-gray-500">대표 이미지</p>
            {imageUrl && imageUrl.startsWith("http") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt={`${product.name} 대표 이미지`}
                className="max-h-64 w-full rounded-lg border border-[#E8DFD8] object-contain bg-[#FAF7F5]"
              />
            ) : (
              <p className="text-sm text-gray-500">
                등록된 대표 이미지가 없거나 아직 불러올 수 없습니다.
              </p>
            )}
          </div>

          <div>
            <p className="text-xs text-gray-500">전성분</p>
            <p className="font-medium tabular-nums">{fullCount}개</p>
          </div>

          <div>
            <p className="text-xs text-gray-500">주요 성분</p>
            {keyList.length === 0 ? (
              <p className="text-sm text-gray-500">자동 추출된 주요 성분이 없습니다.</p>
            ) : (
              <ul className="mt-1 list-inside list-disc text-sm">
                {keyList.map((k) => (
                  <li key={k}>{k}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-[#FAF7F5] px-3 py-3 text-sm">
              <p className="font-medium">판매 정보</p>
              {offers.length === 0 ? (
                <p className="mt-1 text-gray-600">
                  아직 등록된 판매 정보가 없습니다.
                </p>
              ) : (
                <p className="mt-1 tabular-nums">{offers.length}건</p>
              )}
            </div>
            <div className="rounded-lg bg-[#FAF7F5] px-3 py-3 text-sm">
              <p className="font-medium">옵션(변형)</p>
              {variants.length === 0 ? (
                <p className="mt-1 text-gray-600">
                  아직 등록된 옵션이 없습니다.
                </p>
              ) : (
                <p className="mt-1 tabular-nums">{variants.length}건</p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:flex-wrap">
            <Link
              href={`/admin/products/${product.id}`}
              className="inline-flex justify-center rounded bg-[#8B6914] px-4 py-2.5 text-sm font-medium text-white"
            >
              관리자 상세 보기
            </Link>
            <Link
              href="/admin/products/new"
              className="inline-flex justify-center rounded border border-[#E8DFD8] bg-white px-4 py-2.5 text-sm font-medium"
            >
              새 제품 등록
            </Link>
            <Link
              href="/admin/products"
              className="inline-flex justify-center rounded border border-[#E8DFD8] bg-white px-4 py-2.5 text-sm font-medium"
            >
              제품 목록으로 이동
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
